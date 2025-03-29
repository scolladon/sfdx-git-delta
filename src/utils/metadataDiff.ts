'use strict'

import {
  castArray,
  differenceWith,
  isEmpty,
  isEqual,
  isUndefined,
} from 'lodash-es'

import type { Config } from '../types/config.js'
import type { SharedFileMetadata } from '../types/metadata.js'
import type { Manifest } from '../types/work.js'

import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  convertJsonToXml,
  parseXmlFileToJson,
} from './fxpHelper.js'
import { fillPackageWithParameter } from './packageHelper.js'

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
  constructor(readonly attributes: Map<string, SharedFileMetadata>) {}

  getSubTypes(root: XmlContent): string[] {
    return Object.keys(root).filter(tag => this.attributes.has(tag))
  }

  getSubKeys(root: XmlContent): string[] {
    return Object.keys(root).filter(tag => !tag.startsWith(ATTRIBUTE_PREFIX))
  }

  isTypePackageable(subType: string): boolean {
    return !this.attributes.get(subType)?.excluded
  }

  getXmlName(subType: string): string {
    return this.attributes.get(subType)?.xmlName!
  }

  getKeyValueSelector(subType: string): KeySelectorFn {
    const metadataKey = this.getKeyFieldDefinition(subType)
    return elem => elem[metadataKey!] as string
  }

  getKeyFieldDefinition(subType: string): string | undefined {
    return this.attributes.get(subType)?.key
  }

  extractForSubType(root: XmlContent, subType: string): XmlContent[] {
    const content = root[subType]
    return content ? castArray(content) : []
  }

  extractRootElement(fileContent: XmlContent): XmlContent {
    const rootKey =
      Object.keys(fileContent).find(key => key !== XML_HEADER_ATTRIBUTE_KEY) ??
      ''
    return (fileContent[rootKey] as XmlContent) ?? {}
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
    return this.extractor
      .getSubTypes(base)
      .filter(subType => this.extractor.isTypePackageable(subType))
      .reduce((manifest, subType) => {
        const baseMeta = this.extractor.extractForSubType(base, subType)
        const targetMeta = this.extractor.extractForSubType(target, subType)
        const keySelector = this.extractor.getKeyValueSelector(subType)
        const xmlName = this.extractor.getXmlName(subType)

        baseMeta
          .filter(elem => elementMatcher(targetMeta, keySelector, elem))
          .forEach(elem => {
            fillPackageWithParameter({
              store: manifest,
              type: xmlName,
              member: keySelector(elem)!,
            })
          })

        return manifest
      }, new Map())
  }

  private compareAdded = (
    meta: XmlContent[],
    keySelector: KeySelectorFn,
    elem: XmlContent
  ) => {
    const elemKey = keySelector(elem)
    const match = meta.find(el => keySelector(el) === elemKey)
    return !match || !isEqual(match, elem)
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
    const base = structuredClone(toContent)
    const root = this.extractor.extractRootElement(base)
    const from = this.extractor.extractRootElement(fromContent)
    const to = this.extractor.extractRootElement(toContent)

    this.extractor.getSubKeys(root).forEach(key => {
      const fromMeta = this.extractor.extractForSubType(from, key)
      const toMeta = this.extractor.extractForSubType(to, key)
      const keyField = this.extractor.getKeyFieldDefinition(key)

      root[key] = this.getPartialContent(fromMeta, toMeta, keyField)
    })

    return { prunedContent: base, isEmpty: this.isEmpty }
  }

  private getPartialContent(
    fromMeta: XmlContent[],
    toMeta: XmlContent[],
    keyField: string | undefined
  ): XmlContent[] {
    if (isUndefined(keyField)) {
      return this.getPartialContentWithoutKey(fromMeta, toMeta)
    } else if (keyField === '<array>') {
      return this.getPartialContentForArray(fromMeta, toMeta)
    } else {
      return this.getPartialContentWithKey(fromMeta, toMeta)
    }
  }

  private getPartialContentWithoutKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    if (!isEqual(fromMeta, toMeta)) {
      this.isEmpty = false
    }
    return toMeta
  }

  private getPartialContentForArray(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    if (!isEqual(fromMeta, toMeta)) {
      this.isEmpty = false
      return toMeta
    }
    return []
  }

  private getPartialContentWithKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    const diff = differenceWith(toMeta, fromMeta, isEqual)
    if (!isEmpty(diff)) {
      this.isEmpty = false
    }
    return diff
  }
}
