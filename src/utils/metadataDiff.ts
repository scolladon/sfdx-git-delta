'use strict'
import { deepEqual } from 'fast-equals'
import { isUndefined } from 'lodash-es'

import type { Config } from '../types/config.js'
import type { SharedFileMetadata } from '../types/metadata.js'
import type { Manifest } from '../types/work.js'
import {
  ATTRIBUTE_PREFIX,
  convertJsonToXml,
  parseXmlFileToJson,
  XML_HEADER_ATTRIBUTE_KEY,
} from './fxpHelper.js'
import { fillPackageWithParameter } from './packageHelper.js'

const ARRAY_SPECIAL_KEY = '<array>'
const OBJECT_SPECIAL_KEY = '<object>'

const isEmpty = (arr: unknown[]) => arr.length === 0

// biome-ignore lint/suspicious/noExplicitAny: waiting for Salesforce metadata custom type
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
    this.toContent = await parseXmlFileToJson(
      { path, oid: this.config.to },
      this.config
    )
    this.fromContent = await parseXmlFileToJson(
      { path, oid: this.config.from },
      this.config
    )

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

    let result: XmlContent[]
    if (isUndefined(keyField)) {
      result = this.getPartialContentWithoutKey(fromMeta, toMeta)
    } else if (keyField === ARRAY_SPECIAL_KEY) {
      result = this.getPartialContentForArray(fromMeta, toMeta)
    } else if (keyField === OBJECT_SPECIAL_KEY) {
      result = this.getPartialContentForObject(fromMeta, toMeta)
    } else {
      result = this.getPartialContentWithKey(fromMeta, toMeta, keyField)
    }
    return result
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
    const diff = deepEqual(fromMeta, toMeta) ? [] : toMeta
    this.checkEmpty(diff)
    return diff
  }

  private getPartialContentForObject(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    const keySelector = (item: XmlContent[0]) => JSON.stringify(item)
    const fromSet = new Set<string>(fromMeta.map(keySelector))
    const diff = toMeta.filter(item => !fromSet.has(keySelector(item)))

    this.checkEmpty(diff)
    return diff
  }

  private getPartialContentWithKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[],
    keyField: string
  ): XmlContent[] {
    const keySelector = (item: XmlContent[0]) => item[keyField]
    const fromMap = new Map(fromMeta.map(item => [keySelector(item), item]))
    const diff = toMeta.filter(item => {
      const key = keySelector(item)
      const fromItem = fromMap.get(key)
      return isUndefined(fromItem) || !deepEqual(item, fromItem)
    })

    this.checkEmpty(diff)
    return diff
  }

  private checkEmpty(diff: XmlContent[]) {
    if (this.isEmpty) {
      this.isEmpty = isEmpty(diff)
    }
  }
}
