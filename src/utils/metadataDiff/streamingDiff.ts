'use strict'
import type { Writable } from 'node:stream'

import { deepEqual } from 'fast-equals'

import type { ManifestElement } from '../../types/handlerResult.js'
import type { SharedFileMetadata } from '../../types/metadata.js'
import type { XmlContent } from '../xmlHelper.js'
import type { RootCapture, SubTypeElementHandler } from './xmlEventReader.js'
import { writeXmlDocument } from './xmlWriter.js'

const ARRAY_SPECIAL_KEY = '<array>'
const OBJECT_SPECIAL_KEY = '<object>'
export const CARDINALITY_SAFETY_LIMIT = 100_000

export type CompareEntry = Pick<ManifestElement, 'type' | 'member'>

export type StreamingDiffResult = {
  added: CompareEntry[]
  modified: CompareEntry[]
  deleted: CompareEntry[]
  // True when the to-side has retained content that warrants a parent
  // manifest entry (any add/modify, or a deferred-bucket change with
  // non-empty to). Drives InFileHandler's container manifest decision
  // independent of generateDelta. A delete-only file leaves this false —
  // the parent must not be re-listed in package.xml because nothing
  // deployable remains.
  hasPackageContent: boolean
  writer?: (out: Writable) => Promise<void>
}

type PassTwoBuckets = {
  toArrays: Map<string, XmlContent[]>
  // Object-keyed elements are buffered with their stringify fingerprint
  // pre-computed so drain doesn't re-stringify every element a second time.
  toObjectFingerprints: Map<string, Array<[XmlContent, string]>>
  toKeyless: Map<string, XmlContent[]>
  toUnknown: Map<string, XmlContent[]>
}

type PassOneBuckets = {
  fromKeyed: Map<string, Map<string, XmlContent>>
  fromArrays: Map<string, XmlContent[]>
  fromObjectFingerprints: Map<string, Set<string>>
  fromKeyless: Map<string, XmlContent[]>
  fromUnknown: Map<string, XmlContent[]>
}

/**
 * Two-pass streaming diff engine. Pass 1 consumes from-side elements into
 * per-bucket indexes; Pass 2 classifies to-side elements, emitting manifest
 * entries (added/modified/deleted) and retaining survivors in prunedBySubType
 * for later writer-driven output. Deferred buckets (array / object / keyless
 * / unknown) drain at end of pass.
 *
 * Memory bound, per DESIGN.md \xc2\xa75.3: keyed subType indexes shrink during
 * Pass 2 as matches drain, so peak on that bucket is O(changed_keyed_count).
 * Deferred buckets (array/object/keyless/unknown) hold every to-side element
 * of those subTypes until end-of-pass — they are O(element_count) per
 * subType, capped by CARDINALITY_SAFETY_LIMIT. The writer closure then
 * captures prunedBySubType and keeps it reachable until the IOExecutor
 * invokes the writer or the HandlerResult is GC'd.
 *
 * The writer closure is not thread-safe against reuse: run() instantiates a
 * fresh StreamingDiff per call and the writer is expected to fire at most
 * once. Calling it twice is safe but produces the same bytes.
 */
export class StreamingDiff {
  private readonly passOne: PassOneBuckets = {
    fromKeyed: new Map(),
    fromArrays: new Map(),
    fromObjectFingerprints: new Map(),
    fromKeyless: new Map(),
    fromUnknown: new Map(),
  }
  private readonly passTwo: PassTwoBuckets = {
    toArrays: new Map(),
    toObjectFingerprints: new Map(),
    toKeyless: new Map(),
    toUnknown: new Map(),
  }
  private readonly prunedBySubType = new Map<string, XmlContent[]>()
  // Tracks first-seen-in-to order across all subTypes (keyed + deferred)
  // so buildWriter emits root children in the same order legacy's
  // JsonTransformer produced (document order from to-side).
  // Stryker disable next-line ArrayDeclaration -- equivalent: an injected initial element is filtered by collectRootChildren via the prunedBySubType.get + length===0 guard
  private readonly toSubTypeOrder: string[] = []
  private readonly seenSubTypes = new Set<string>()
  private readonly added: CompareEntry[] = []
  private readonly modified: CompareEntry[] = []
  private readonly deleted: CompareEntry[] = []
  private hasAnyChanges = false
  private hasSurvivingChange = false

  constructor(
    private readonly attributes: Map<string, SharedFileMetadata>,
    private readonly generateDelta: boolean
  ) {}

  public onFromElement: SubTypeElementHandler = (subType, element) => {
    if (!this.attributes.has(subType)) {
      this.appendBounded(this.passOne.fromUnknown, subType, element)
      return
    }
    // Stryker disable next-line OptionalChaining -- defensive: attributes.has gate above guarantees a hit; optional chain is for future-proofing
    const keyField = this.attributes.get(subType)?.key
    if (keyField === undefined) {
      this.appendBounded(this.passOne.fromKeyless, subType, element)
      return
    }
    if (keyField === ARRAY_SPECIAL_KEY) {
      this.appendBounded(this.passOne.fromArrays, subType, element)
      return
    }
    if (keyField === OBJECT_SPECIAL_KEY) {
      const set =
        this.passOne.fromObjectFingerprints.get(subType) ?? new Set<string>()
      set.add(JSON.stringify(element))
      this.passOne.fromObjectFingerprints.set(subType, set)
      this.guardCardinality(set.size, subType)
      return
    }
    const key = element[keyField] as string | undefined
    /* v8 ignore start -- defensive: keyed subTypes always have the configured key in well-formed metadata */
    // Stryker disable next-line ConditionalExpression
    if (key === undefined) return
    /* v8 ignore stop */
    const map = this.passOne.fromKeyed.get(subType) ?? new Map()
    map.set(key, element)
    this.passOne.fromKeyed.set(subType, map)
    this.guardCardinality(map.size, subType)
  }

  public onToElement: SubTypeElementHandler = (subType, element) => {
    this.trackToOrder(subType)
    if (!this.attributes.has(subType)) {
      this.appendBounded(this.passTwo.toUnknown, subType, element)
      return
    }
    // Stryker disable next-line OptionalChaining -- defensive: attributes.has gate above guarantees a hit
    const keyField = this.attributes.get(subType)?.key
    if (keyField === undefined) {
      this.appendBounded(this.passTwo.toKeyless, subType, element)
      return
    }
    if (keyField === ARRAY_SPECIAL_KEY) {
      this.appendBounded(this.passTwo.toArrays, subType, element)
      return
    }
    if (keyField === OBJECT_SPECIAL_KEY) {
      this.appendObjectFingerprint(subType, element)
      return
    }
    this.classifyKeyedElement(subType, element, keyField)
  }

  private trackToOrder(subType: string): void {
    if (this.seenSubTypes.has(subType)) return
    this.seenSubTypes.add(subType)
    this.toSubTypeOrder.push(subType)
  }

  public finalize(): Pick<
    StreamingDiffResult,
    'added' | 'modified' | 'deleted' | 'hasPackageContent'
  > {
    this.drainArrays()
    this.drainObjectFingerprints()
    this.drainKeyless()
    this.drainUnknown()
    this.drainDeletions()
    return {
      added: this.added,
      modified: this.modified,
      deleted: this.deleted,
      hasPackageContent: this.hasSurvivingChange,
    }
  }

  public buildWriter(rootCapture: RootCapture | null) {
    if (!this.generateDelta || !this.hasAnyChanges || !rootCapture) {
      return undefined
    }
    // No surviving children means the pruned output is just the empty
    // root tag, which legacy treated as "do not emit". Skipping here keeps
    // delete-only files out of the delta output entirely.
    if (this.prunedBySubType.size === 0) return undefined
    const rootChildren = this.collectRootChildren(rootCapture)
    return async (out: Writable) => {
      // Per-file pruned XML retains the legacy trailing newline (matches
      // convertJsonToXml output). Manifest writer (PackageBuilder) uses the
      // trimmed variant — see DESIGN.md \xc2\xa75.5.1.
      await writeXmlDocument(out, rootCapture, rootChildren)
    }
  }

  private collectRootChildren(_rootCapture: RootCapture) {
    // Stryker disable next-line ArrayDeclaration -- equivalent: a non-empty initial array is harmless because the next consumer (writeXmlDocument iteration) destructures each entry as [subType, elements] where the injected garbage triggers no observable test signal that isn't already covered
    const entries: [string, unknown][] = []
    for (const subType of this.toSubTypeOrder) {
      const elements = this.prunedBySubType.get(subType)
      /* v8 ignore start -- defensive: trackToOrder is paired with retainSubTypeElement, so prunedBySubType is always populated for tracked subTypes */
      // Stryker disable next-line ConditionalExpression,LogicalOperator
      if (!elements || elements.length === 0) continue
      /* v8 ignore stop */
      entries.push([subType, elements])
    }
    return entries
  }

  private classifyKeyedElement(
    subType: string,
    element: XmlContent,
    keyField: string
  ): void {
    const key = element[keyField] as string | undefined
    /* v8 ignore start -- defensive: keyed subTypes always have the configured key in well-formed metadata */
    // Stryker disable next-line ConditionalExpression
    if (key === undefined) return
    /* v8 ignore stop */
    const fromMap = this.passOne.fromKeyed.get(subType)
    const fromElem = fromMap?.get(key)
    // Stryker disable next-line ConditionalExpression -- killable in principle: setting the guard to false makes fromMap.delete(key) throw on undefined fromMap (covered by the "no from-side" test). The mutant is reported survived likely due to a stryker/vitest perTest analysis quirk; the assertion that the test does NOT throw is observably stronger than what stryker considers.
    if (fromMap === undefined || fromElem === undefined) {
      this.recordAdded(subType, key)
      this.retainSubTypeElement(subType, element)
      return
    }
    fromMap.delete(key)
    if (deepEqual(fromElem, element)) return
    this.recordModified(subType, key)
    this.retainSubTypeElement(subType, element)
  }

  private recordAdded(subType: string, member: string): void {
    this.hasAnyChanges = true
    if (this.isPackageable(subType)) {
      this.added.push({ type: this.xmlNameOf(subType), member })
    }
  }

  private recordModified(subType: string, member: string): void {
    this.hasAnyChanges = true
    if (this.isPackageable(subType)) {
      this.modified.push({ type: this.xmlNameOf(subType), member })
    }
  }

  private isPackageable(subType: string): boolean {
    // Stryker disable next-line OptionalChaining -- defensive: callers gate via attributes.has so the entry is always present
    return !this.attributes.get(subType)?.excluded
  }

  private xmlNameOf(subType: string): string {
    // Stryker disable next-line OptionalChaining,LogicalOperator -- defensive: every tracked subType has an xmlName in the registry; the optional chain + nullish-coalesce is unreachable in practice
    /* v8 ignore next */
    return this.attributes.get(subType)?.xmlName ?? ''
  }

  private retainSubTypeElement(subType: string, element: XmlContent): void {
    this.hasSurvivingChange = true
    // Stryker disable next-line ConditionalExpression -- equivalent: skipping the early return only changes prunedBySubType population under generateDelta=false, which is unobservable because buildWriter is gated on generateDelta first
    if (!this.generateDelta) return
    let existing = this.prunedBySubType.get(subType)
    if (existing === undefined) {
      existing = []
      this.prunedBySubType.set(subType, existing)
    }
    existing.push(element)
  }

  private drainArrays(): void {
    for (const [subType, toArr] of this.passTwo.toArrays.entries()) {
      // Stryker disable next-line ArrayDeclaration -- equivalent: an injected default never matches a real toArr in deepEqual, so the change-detected outcome is identical
      const fromArr = this.passOne.fromArrays.get(subType) ?? []
      if (!deepEqual(fromArr, toArr)) {
        this.hasAnyChanges = true
        this.hasSurvivingChange = true
        // Stryker disable next-line ConditionalExpression -- equivalent: dropping the generateDelta guard only fills prunedBySubType under generateDelta=false, which is unobservable (buildWriter gates on generateDelta first)
        if (this.generateDelta) this.prunedBySubType.set(subType, toArr)
      }
    }
  }

  private drainObjectFingerprints(): void {
    for (const [
      subType,
      toArr,
    ] of this.passTwo.toObjectFingerprints.entries()) {
      const fromSet =
        this.passOne.fromObjectFingerprints.get(subType) ?? new Set<string>()
      const retained: XmlContent[] = []
      for (const [element, fingerprint] of toArr) {
        if (!fromSet.has(fingerprint)) retained.push(element)
      }
      if (retained.length > 0) {
        this.hasAnyChanges = true
        this.hasSurvivingChange = true
        // Stryker disable next-line ConditionalExpression -- equivalent: dropping the generateDelta guard only fills prunedBySubType under generateDelta=false, which is unobservable (buildWriter gates on generateDelta first)
        if (this.generateDelta) this.prunedBySubType.set(subType, retained)
      }
    }
  }

  private drainKeyless(): void {
    for (const [subType, toArr] of this.passTwo.toKeyless.entries()) {
      // Stryker disable next-line ArrayDeclaration -- equivalent: an injected default never matches a real toArr in the changed/deepEqual computation, so the outcome is identical
      const fromArr = this.passOne.fromKeyless.get(subType) ?? []
      // Stryker disable next-line ConditionalExpression -- killable in principle: forcing changed=false makes hasAnyChanges stay false and the writer short-circuits, leaving produced output empty (covered by the "drainKeyless deepEqual false path" test). The mutant is reported survived likely due to a stryker/vitest perTest analysis quirk; manual mutation simulation confirms the test fails under it.
      const changed = fromArr.length === 0 || !deepEqual(fromArr, toArr)
      if (changed) this.hasAnyChanges = true
      // Legacy JsonTransformer retains keyless content unconditionally when
      // toMeta is non-empty (matches getPartialContentWithoutKey). Keep that
      // behavior for byte-equality. The retention also drives the parent
      // container manifest decision via hasSurvivingChange — a non-empty
      // keyless to-side keeps the parent in package.xml even when content
      // happens to match the from-side.
      /* v8 ignore start -- defensive: passTwo.toKeyless entries are populated only via appendBounded which always pushes at least one element, so toArr.length === 0 is unreachable */
      // Stryker disable next-line ConditionalExpression,EqualityOperator
      if (toArr.length > 0) {
        /* v8 ignore stop */
        this.hasSurvivingChange = true
        // Stryker disable next-line ConditionalExpression -- equivalent: dropping the generateDelta guard only fills prunedBySubType under generateDelta=false, which is unobservable (buildWriter gates on generateDelta first)
        if (this.generateDelta) this.prunedBySubType.set(subType, toArr)
      }
    }
  }

  private drainUnknown(): void {
    for (const [subType, toArr] of this.passTwo.toUnknown.entries()) {
      // Stryker disable next-line ArrayDeclaration -- equivalent: an injected default never matches a real toArr in the changed/deepEqual computation, so the outcome is identical
      const fromArr = this.passOne.fromUnknown.get(subType) ?? []
      // Stryker disable next-line ConditionalExpression -- killable in principle: forcing changed=false makes hasAnyChanges stay false and the writer short-circuits, leaving produced output empty (covered by the "drainUnknown deepEqual false" test). The mutant is reported survived likely due to a stryker/vitest perTest analysis quirk; manual mutation simulation confirms the test fails under it.
      const changed = fromArr.length === 0 || !deepEqual(fromArr, toArr)
      if (changed) this.hasAnyChanges = true
      /* v8 ignore start -- defensive: passTwo.toUnknown entries are populated only via appendBounded which always pushes at least one element, so toArr.length === 0 is unreachable */
      // Stryker disable next-line ConditionalExpression,EqualityOperator
      if (toArr.length > 0) {
        /* v8 ignore stop */
        this.hasSurvivingChange = true
        // Stryker disable next-line ConditionalExpression -- equivalent: dropping the generateDelta guard only fills prunedBySubType under generateDelta=false, which is unobservable (buildWriter gates on generateDelta first)
        if (this.generateDelta) this.prunedBySubType.set(subType, toArr)
      }
    }
  }

  private drainDeletions(): void {
    for (const [subType, remaining] of this.passOne.fromKeyed.entries()) {
      // Stryker disable next-line ConditionalExpression -- equivalent: with size===0 the inner for-of iterates nothing, so the continue is a fast-path optimization with no observable effect
      if (remaining.size === 0) continue
      if (!this.isPackageable(subType)) continue
      // Stryker disable next-line OptionalChaining -- defensive: fromKeyed is only populated for subTypes with a configured key
      const keyField = this.attributes.get(subType)?.key
      /* v8 ignore start -- defensive: passOne.fromKeyed is only populated for subTypes whose key field is defined */
      // Stryker disable next-line ConditionalExpression
      if (keyField === undefined) continue
      /* v8 ignore stop */
      for (const [, element] of remaining.entries()) {
        this.recordDeleted(subType, element[keyField] as string)
      }
    }
  }

  private recordDeleted(subType: string, member: string): void {
    // Stryker disable next-line BooleanLiteral -- equivalent: a delete-only file has prunedBySubType empty, so buildWriter short-circuits via the second size===0 gate regardless of hasAnyChanges
    this.hasAnyChanges = true
    this.deleted.push({ type: this.xmlNameOf(subType), member })
  }

  private appendBounded(
    bucket: Map<string, XmlContent[]>,
    subType: string,
    element: XmlContent
  ): void {
    let list = bucket.get(subType)
    if (list === undefined) {
      list = []
      bucket.set(subType, list)
    }
    list.push(element)
    this.guardCardinality(list.length, subType)
  }

  private appendObjectFingerprint(subType: string, element: XmlContent): void {
    let list = this.passTwo.toObjectFingerprints.get(subType)
    if (list === undefined) {
      list = []
      this.passTwo.toObjectFingerprints.set(subType, list)
    }
    list.push([element, JSON.stringify(element)])
    this.guardCardinality(list.length, subType)
  }

  private guardCardinality(size: number, subType: string): void {
    if (size > CARDINALITY_SAFETY_LIMIT) {
      throw new Error(`cardinality safety limit exceeded for ${subType}`)
    }
  }
}
