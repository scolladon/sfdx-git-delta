'use strict'
import type { Writable } from 'node:stream'

import { deepEqual } from 'fast-equals'

import type { ManifestElement } from '../../types/handlerResult.js'
import type { SharedFileMetadata } from '../../types/metadata.js'
import type { XmlContent } from '../xmlHelper.js'
import type { RootCapture, SubTypeElementHandler } from './xmlEventReader.js'
import { writeXmlDocument } from './xmlWriter.js'

export const ARRAY_SPECIAL_KEY = '<array>'
export const OBJECT_SPECIAL_KEY = '<object>'
export const CARDINALITY_SAFETY_LIMIT = 100_000

export type CompareEntry = Pick<ManifestElement, 'type' | 'member'>

export type StreamingDiffResult = {
  added: CompareEntry[]
  modified: CompareEntry[]
  deleted: CompareEntry[]
  hasAnyChanges: boolean
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
  private readonly toSubTypeOrder: string[] = []
  private readonly seenSubTypes = new Set<string>()
  private readonly added: CompareEntry[] = []
  private readonly modified: CompareEntry[] = []
  private readonly deleted: CompareEntry[] = []
  private hasAnyChanges = false

  constructor(
    private readonly attributes: Map<string, SharedFileMetadata>,
    private readonly generateDelta: boolean
  ) {}

  public onFromElement: SubTypeElementHandler = (subType, element) => {
    if (!this.attributes.has(subType)) {
      this.appendBounded(this.passOne.fromUnknown, subType, element)
      return
    }
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
    if (key === undefined) return
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
    'added' | 'modified' | 'deleted' | 'hasAnyChanges'
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
      hasAnyChanges: this.hasAnyChanges,
    }
  }

  public buildWriter(rootCapture: RootCapture | null) {
    if (!this.generateDelta || !this.hasAnyChanges || !rootCapture) {
      return undefined
    }
    const rootChildren = this.collectRootChildren(rootCapture)
    return async (out: Writable) => {
      // Per-file pruned XML retains the legacy trailing newline (matches
      // convertJsonToXml output). Manifest writer (PackageBuilder) uses the
      // trimmed variant — see DESIGN.md \xc2\xa75.5.1.
      await writeXmlDocument(out, rootCapture, rootChildren)
    }
  }

  private collectRootChildren(_rootCapture: RootCapture) {
    const entries: [string, unknown][] = []
    for (const subType of this.toSubTypeOrder) {
      const elements = this.prunedBySubType.get(subType)
      if (!elements || elements.length === 0) continue
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
    if (key === undefined) return
    const fromMap = this.passOne.fromKeyed.get(subType)
    const fromElem = fromMap?.get(key)
    if (fromElem === undefined) {
      this.recordAdded(subType, key)
      this.retainSubTypeElement(subType, element)
      return
    }
    fromMap!.delete(key)
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
    return !this.attributes.get(subType)?.excluded
  }

  private xmlNameOf(subType: string): string {
    return this.attributes.get(subType)?.xmlName ?? ''
  }

  private retainSubTypeElement(subType: string, element: XmlContent): void {
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
      const fromArr = this.passOne.fromArrays.get(subType) ?? []
      if (!deepEqual(fromArr, toArr)) {
        this.hasAnyChanges = true
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
        if (this.generateDelta) this.prunedBySubType.set(subType, retained)
      }
    }
  }

  private drainKeyless(): void {
    for (const [subType, toArr] of this.passTwo.toKeyless.entries()) {
      const fromArr = this.passOne.fromKeyless.get(subType) ?? []
      const changed = fromArr.length === 0 || !deepEqual(fromArr, toArr)
      if (changed) this.hasAnyChanges = true
      // Legacy JsonTransformer retains keyless content unconditionally when
      // toMeta is non-empty (matches getPartialContentWithoutKey). Keep that
      // behavior for byte-equality.
      if (this.generateDelta && toArr.length > 0) {
        this.prunedBySubType.set(subType, toArr)
      }
    }
  }

  private drainUnknown(): void {
    for (const [subType, toArr] of this.passTwo.toUnknown.entries()) {
      const fromArr = this.passOne.fromUnknown.get(subType) ?? []
      const changed = fromArr.length === 0 || !deepEqual(fromArr, toArr)
      if (changed) this.hasAnyChanges = true
      if (this.generateDelta && toArr.length > 0) {
        this.prunedBySubType.set(subType, toArr)
      }
    }
  }

  private drainDeletions(): void {
    for (const [subType, remaining] of this.passOne.fromKeyed.entries()) {
      if (remaining.size === 0) continue
      if (!this.isPackageable(subType)) continue
      const keyField = this.attributes.get(subType)?.key
      if (keyField === undefined) continue
      for (const [, element] of remaining.entries()) {
        this.recordDeleted(subType, element[keyField] as string)
      }
    }
  }

  private recordDeleted(subType: string, member: string): void {
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
