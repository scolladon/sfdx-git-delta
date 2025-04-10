'use strict'

import { deepEqual } from 'fast-equals'
import { isUndefined } from 'lodash-es'

import type { Config } from '../types/config.js'
import type { SharedFileMetadata } from '../types/metadata.js'
import type { Manifest } from '../types/work.js'

import {
  XML_HEADER_ATTRIBUTE_KEY,
  convertJsonToXml,
  parseXmlFileToJson,
} from './fxpHelper.js'
import { ATTRIBUTE_PREFIX } from './fxpHelper.js'
import { fillPackageWithParameter } from './packageHelper.js'

const ARRAY_SPECIAL_KEY = '<array>'
const OBJECT_SPECIAL_KEY = '<object>'

const isEmpty = (arr: unknown[]) => arr.length === 0

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type XmlContent = Record<string, any>

type KeySelectorFn = (elem: XmlContent) => string | undefined

interface DiffResult {
  added: Manifest
  deleted: Manifest
}

interface PrunedContent {
  xmlContent: string
  isEmpty: boolean
}

export default class MetadataDiff {
  private toContent!: XmlContent
  private fromContent!: XmlContent
  private extractor: MetadataExtractor

  constructor(
    private config: Config,
    attributes: Map<string, SharedFileMetadata>
  ) {
    this.extractor = new MetadataExtractor(attributes)
  }

  async compare(path: string): Promise<DiffResult> {
    const [toContent, fromContent] = await Promise.all([
      parseXmlFileToJson({ path, oid: this.config.to }, this.config),
      parseXmlFileToJson({ path, oid: this.config.from }, this.config),
    ])

    this.toContent = toContent
    this.fromContent = fromContent

    const comparator = new MetadataComparator(
      this.extractor,
      this.fromContent,
      this.toContent
    )

    const added = comparator.getChanges()
    const deleted = comparator.getDeletion()

    return { added, deleted }
  }

  prune(): PrunedContent {
    const transformer = new JsonTransformer(this.extractor)
    const { prunedContent, isEmpty } = transformer.generatePartialJson(
      this.fromContent,
      this.toContent
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
    const content = root[subType]
    // Only cast to array if it's not already an array
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
    return this.compare(this.toContent, this.fromContent, this.compareAdded)
  }

  getDeletion() {
    return this.compare(this.fromContent, this.toContent, this.compareDeleted)
  }

  private compare(
    baseContent: XmlContent,
    targetContent: XmlContent,
    elementMatcher: (
      meta: XmlContent[],
      keySelector: KeySelectorFn,
      elem: XmlContent
    ) => boolean
  ): Manifest {
    const base = this.extractor.extractRootElement(baseContent)
    const target = this.extractor.extractRootElement(targetContent)
    const manifest = new Map()

    // Get all subtypes once
    const subTypes = this.extractor.getSubTypes(base)
    for (const subType of subTypes) {
      if (!this.extractor.isTypePackageable(subType)) continue

      const baseMeta = this.extractor.extractForSubType(base, subType)
      if (isEmpty(baseMeta)) continue

      const targetMeta = this.extractor.extractForSubType(target, subType)
      const keySelector = this.extractor.getKeyValueSelector(subType)
      const xmlName = this.extractor.getXmlName(subType)

      for (const elem of baseMeta) {
        if (elementMatcher(targetMeta, keySelector, elem)) {
          fillPackageWithParameter({
            store: manifest,
            type: xmlName,
            member: keySelector(elem)!,
          })
        }
      }
    }

    return manifest
  }

  private compareAdded = (
    meta: XmlContent[],
    keySelector: KeySelectorFn,
    elem: XmlContent
  ) => {
    const elemKey = keySelector(elem)
    const match = meta.find(el => keySelector(el) === elemKey)
    return !match || !deepEqual(match, elem)
  }

  private compareDeleted = (
    meta: XmlContent[],
    keySelector: KeySelectorFn,
    elem: XmlContent
  ) => {
    const elemKey = keySelector(elem)
    return !meta.some(el => keySelector(el) === elemKey)
  }
}

class JsonTransformer {
  private isEmpty: boolean = true

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
    base[rootKey] = {}
    const root = base[rootKey]
    const subKeys = this.extractor.getSubKeys(to)
    for (const key of subKeys) {
      if (key.startsWith(ATTRIBUTE_PREFIX)) {
        root[key] = to[key]
        continue
      }
      const fromMeta = this.extractor.extractForSubType(from, key)
      const toMeta = this.extractor.extractForSubType(to, key)
      const keyField = this.extractor.getKeyFieldDefinition(key)
      const partialContent = this.getPartialContent(fromMeta, toMeta, keyField)
      if (!isEmpty(partialContent)) {
        root[key] = partialContent
      }
    }
    return { prunedContent: base, isEmpty: this.isEmpty }
  }

  private getPartialContent(
    fromMeta: XmlContent[],
    toMeta: XmlContent[],
    keyField: string | undefined
  ): XmlContent[] {
    // Early return for empty arrays
    if (isEmpty(toMeta)) {
      return []
    }
    if (isEmpty(fromMeta)) {
      this.isEmpty = false
      return toMeta
    }

    if (isUndefined(keyField)) {
      return this.getPartialContentWithoutKey(fromMeta, toMeta)
    } else if (keyField === ARRAY_SPECIAL_KEY) {
      return this.getPartialContentForArray(fromMeta, toMeta)
    } else if (keyField === OBJECT_SPECIAL_KEY) {
      return this.getPartialContentForObject(fromMeta, toMeta)
    } else {
      return this.getPartialContentWithKey(fromMeta, toMeta, keyField)
    }
  }

  private getPartialContentWithoutKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    if (!deepEqual(fromMeta, toMeta)) {
      this.isEmpty = false
    }
    return toMeta
  }

  private getPartialContentForArray(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    if (!deepEqual(fromMeta, toMeta)) {
      this.isEmpty = false
      return toMeta
    }
    return []
  }

  private getPartialContentForObject(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    const genKey = (item: XmlContent[0]) => JSON.stringify(item)
    // Build set of stringified fromMeta elements
    const fromSet = new Set<string>(fromMeta.map(genKey))
    // Filter toMeta to only include items not in fromSet
    const diff = toMeta.filter(item => !fromSet.has(genKey(item)))

    if (!isEmpty(diff)) {
      this.isEmpty = false
    }

    return diff
  }

  private getPartialContentWithKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[],
    keyField: string
  ): XmlContent[] {
    const genKey = (item: XmlContent[0]) => item[keyField]
    // Build map of keyField values to items
    const fromMap = new Map(fromMeta.map(item => [genKey(item), item]))

    // Filter toMeta to include items that:
    // 1. Don't exist in fromMap (new items)
    // 2. Exist but have changed (modified items, detected by !deepEqual)
    const diff = toMeta.filter(item => {
      const key = genKey(item)
      const fromItem = fromMap.get(key)
      return !fromItem || !deepEqual(item, fromItem)
    })

    if (!isEmpty(diff)) {
      this.isEmpty = false
    }

    return diff
  }
}
