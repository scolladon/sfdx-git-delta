'use strict'
import { deepEqual } from 'fast-equals'
import { isUndefined } from 'lodash-es'

import type { Config } from '../types/config.js'
import type { ManifestElement } from '../types/handlerResult.js'
import type { SharedFileMetadata } from '../types/metadata.js'
import { log } from './LoggingDecorator.js'
import {
  ATTRIBUTE_PREFIX,
  convertJsonToXml,
  parseXmlFileToJson,
  XML_HEADER_ATTRIBUTE_KEY,
  type XmlContent,
} from './xmlHelper.js'

/**
 * Special key markers for metadata comparison strategies.
 * These are used in the internalRegistry to define how metadata elements
 * should be compared when they lack a natural unique key field.
 *
 * ARRAY_SPECIAL_KEY ('<array>'): Compare arrays as a whole.
 *   If arrays differ at all, include the entire 'to' array in the output.
 *   Used for metadata where order matters or elements can't be individually identified.
 *   Example: loginHours, loginIpRanges in Profile metadata.
 *
 * OBJECT_SPECIAL_KEY ('<object>'): Compare objects by their serialized form.
 *   Uses JSON.stringify to create a key for each element, then includes
 *   only elements from 'to' that don't exist in 'from'.
 *   Used for metadata where each element is unique but has no key field.
 *   Example: layoutAssignments in Profile metadata.
 *
 * When neither marker is used and no key field is defined, the comparison
 * falls back to deep equality of the entire array, returning 'to' if different.
 */
const ARRAY_SPECIAL_KEY = '<array>'
const OBJECT_SPECIAL_KEY = '<object>'

const isEmpty = (arr: unknown[]) => arr.length === 0

type KeySelectorFn = (elem: XmlContent) => string | undefined

type CompareEntry = Pick<ManifestElement, 'type' | 'member'>

interface CompareResult {
  added: CompareEntry[]
  deleted: CompareEntry[]
  toContent: XmlContent
  fromContent: XmlContent
}

export interface PrunedContent {
  xmlContent: string
  isEmpty: boolean
}

export default class MetadataDiff {
  private extractor: MetadataExtractor

  constructor(
    private config: Config,
    attributes: Map<string, SharedFileMetadata>
  ) {
    this.extractor = new MetadataExtractor(attributes)
  }

  @log
  async compare(path: string): Promise<CompareResult> {
    const toContent = await parseXmlFileToJson(
      { path, oid: this.config.to },
      this.config
    )
    const fromContent = await parseXmlFileToJson(
      { path, oid: this.config.from },
      this.config
    )

    const comparator = new MetadataComparator(
      this.extractor,
      fromContent,
      toContent
    )

    const added = comparator.getChanges()
    const deleted = comparator.getDeletion()

    return { added, deleted, toContent, fromContent }
  }

  @log
  prune(toContent: XmlContent, fromContent: XmlContent): PrunedContent {
    const transformer = new JsonTransformer(this.extractor)
    const { prunedContent, isEmpty } = transformer.generatePartialJson(
      fromContent,
      toContent
    )

    return {
      xmlContent: convertJsonToXml(prunedContent),
      isEmpty,
    }
  }
}

class MetadataExtractor {
  private keySelectorCache = new Map<string, KeySelectorFn>()

  constructor(readonly attributes: Map<string, SharedFileMetadata>) {}

  getSubTypes(root: XmlContent): string[] {
    return Object.keys(root).filter(tag => this.attributes.has(tag))
  }

  getSubKeys(root: XmlContent): string[] {
    return Object.keys(root)
  }

  isTypePackageable(subType: string): boolean {
    return !this.attributes.get(subType)?.excluded
  }

  getXmlName(subType: string): string {
    return this.attributes.get(subType)?.xmlName!
  }

  getKeyValueSelector(subType: string): KeySelectorFn {
    if (!this.keySelectorCache.has(subType)) {
      const metadataKey = this.getKeyFieldDefinition(subType)
      this.keySelectorCache.set(subType, elem => elem[metadataKey!] as string)
    }
    return this.keySelectorCache.get(subType)!
  }

  getKeyFieldDefinition(subType: string): string | undefined {
    return this.attributes.get(subType)?.key
  }

  extractForSubType(root: XmlContent, subType: string): XmlContent[] {
    const content = root[subType] as XmlContent | XmlContent[] | undefined
    return Array.isArray(content) ? content : content ? [content] : []
  }

  extractRootElement(fileContent: XmlContent): XmlContent {
    const rootKey = this.extractRootKey(fileContent)
    return (fileContent[rootKey] as XmlContent) ?? {}
  }

  extractRootKey(fileContent: XmlContent): string {
    return (
      Object.keys(fileContent).find(key => key !== XML_HEADER_ATTRIBUTE_KEY) ??
      ''
    )
  }
}

class MetadataComparator {
  constructor(
    private extractor: MetadataExtractor,
    private fromContent: XmlContent,
    private toContent: XmlContent
  ) {}

  getChanges() {
    return this.compare(this.toContent, this.fromContent, this.matchAdded)
  }

  getDeletion() {
    return this.compare(this.fromContent, this.toContent, this.matchDeleted)
  }

  private compare(
    baseContent: XmlContent,
    targetContent: XmlContent,
    elementMatcher: (
      targetLookup: Map<string, XmlContent>,
      keySelector: KeySelectorFn,
      elem: XmlContent
    ) => boolean
  ): CompareEntry[] {
    const base = this.extractor.extractRootElement(baseContent)
    const target = this.extractor.extractRootElement(targetContent)
    const entries: CompareEntry[] = []

    const subTypes = this.extractor.getSubTypes(base)
    for (const subType of subTypes) {
      if (!this.extractor.isTypePackageable(subType)) continue

      const baseMeta = this.extractor.extractForSubType(base, subType)
      if (isEmpty(baseMeta)) continue

      const targetMeta = this.extractor.extractForSubType(target, subType)
      const keySelector = this.extractor.getKeyValueSelector(subType)
      const xmlName = this.extractor.getXmlName(subType)

      // Pre-compute lookup map: O(n) instead of O(n) per element
      const targetLookup = new Map<string, XmlContent>()
      for (const el of targetMeta) {
        const key = keySelector(el)
        if (key !== undefined) {
          targetLookup.set(key, el)
        }
      }

      for (const elem of baseMeta) {
        if (elementMatcher(targetLookup, keySelector, elem)) {
          entries.push({ type: xmlName, member: keySelector(elem)! })
        }
      }
    }

    return entries
  }

  // O(1) lookup instead of O(n) find()
  private matchAdded = (
    targetLookup: Map<string, XmlContent>,
    keySelector: KeySelectorFn,
    elem: XmlContent
  ) => {
    const elemKey = keySelector(elem)
    if (elemKey === undefined) return true
    const match = targetLookup.get(elemKey)
    return !match || !deepEqual(match, elem)
  }

  // O(1) lookup instead of O(n) some()
  private matchDeleted = (
    targetLookup: Map<string, XmlContent>,
    keySelector: KeySelectorFn,
    elem: XmlContent
  ) => {
    const elemKey = keySelector(elem)
    if (elemKey === undefined) return true
    return !targetLookup.has(elemKey)
  }
}

interface PartialResult {
  content: XmlContent[]
  hasChanges: boolean
}

class JsonTransformer {
  constructor(private extractor: MetadataExtractor) {}

  generatePartialJson(
    fromContent: XmlContent,
    toContent: XmlContent
  ): { prunedContent: XmlContent; isEmpty: boolean } {
    const from = this.extractor.extractRootElement(fromContent)
    const to = this.extractor.extractRootElement(toContent)
    const base: XmlContent = {}
    if (XML_HEADER_ATTRIBUTE_KEY in toContent) {
      base[XML_HEADER_ATTRIBUTE_KEY] = toContent[XML_HEADER_ATTRIBUTE_KEY]
    }
    const rootKey = this.extractor.extractRootKey(toContent)
    const root: XmlContent = {}
    base[rootKey] = root
    const subKeys = this.extractor.getSubKeys(to)

    let hasAnyChanges = false
    for (const key of subKeys) {
      if (key.startsWith(ATTRIBUTE_PREFIX)) {
        root[key] = to[key]
        continue
      }
      const fromMeta = this.extractor.extractForSubType(from, key)
      const toMeta = this.extractor.extractForSubType(to, key)
      const keyField = this.extractor.getKeyFieldDefinition(key)
      const { content, hasChanges } = this.getPartialContent(
        fromMeta,
        toMeta,
        keyField
      )
      if (hasChanges) {
        hasAnyChanges = true
      }
      if (!isEmpty(content)) {
        root[key] = content
      }
    }
    return { prunedContent: base, isEmpty: !hasAnyChanges }
  }

  private getPartialContent(
    fromMeta: XmlContent[],
    toMeta: XmlContent[],
    keyField: string | undefined
  ): PartialResult {
    // Early return for empty arrays
    if (isEmpty(toMeta)) {
      return { content: [], hasChanges: false }
    }
    if (isEmpty(fromMeta)) {
      return { content: toMeta, hasChanges: true }
    }

    if (isUndefined(keyField)) {
      return this.getPartialContentWithoutKey(fromMeta, toMeta)
    }
    if (keyField === ARRAY_SPECIAL_KEY) {
      return this.getPartialContentForArray(fromMeta, toMeta)
    }
    if (keyField === OBJECT_SPECIAL_KEY) {
      return this.getPartialContentForObject(fromMeta, toMeta)
    }
    return this.getPartialContentWithKey(fromMeta, toMeta, keyField)
  }

  private getPartialContentWithoutKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): PartialResult {
    const hasChanges = !deepEqual(fromMeta, toMeta)
    return { content: toMeta, hasChanges }
  }

  private getPartialContentForArray(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): PartialResult {
    const hasChanges = !deepEqual(fromMeta, toMeta)
    const content = hasChanges ? toMeta : []
    return { content, hasChanges }
  }

  private getPartialContentForObject(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): PartialResult {
    const keySelector = (item: XmlContent[0]) => JSON.stringify(item)
    const fromSet = new Set<string>(fromMeta.map(keySelector))
    const content = toMeta.filter(item => !fromSet.has(keySelector(item)))
    return { content, hasChanges: !isEmpty(content) }
  }

  private getPartialContentWithKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[],
    keyField: string
  ): PartialResult {
    const keySelector = (item: XmlContent) =>
      item[keyField] as string | undefined
    const fromMap = new Map(fromMeta.map(item => [keySelector(item), item]))
    const content = toMeta.filter(item => {
      const key = keySelector(item)
      const fromItem = fromMap.get(key)
      return isUndefined(fromItem) || !deepEqual(item, fromItem)
    })
    return { content, hasChanges: !isEmpty(content) }
  }
}
