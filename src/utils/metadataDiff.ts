'use strict'

import { castArray, differenceWith, isEqual, isUndefined } from 'lodash'
import type { Config } from '../types/config'
import type { SharedFileMetadata } from '../types/metadata'
import type { Manifest } from '../types/work'
import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  convertJsonToXml,
  parseXmlFileToJson,
} from './fxpHelper'
import { fillPackageWithParameter } from './packageHelper'

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
    const prunedContent = transformer.generatePartialJson(
      this.fromContent,
      this.toContent
    )

    return {
      xmlContent: convertJsonToXml(prunedContent),
      isEmpty: this.extractor.isContentEmpty(prunedContent),
    }
  }
}

class MetadataExtractor {
  constructor(readonly attributes: Map<string, SharedFileMetadata>) {}

  getSubTypes(fileContent: XmlContent): string[] {
    const root = this.extractRootElement(fileContent)
    return Object.keys(root).filter(tag => this.attributes.has(tag))
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

  extractForSubType(fileContent: XmlContent, subType: string): XmlContent[] {
    const root = this.extractRootElement(fileContent)
    const content = root[subType]
    return content ? castArray(content) : []
  }

  isContentEmpty(fileContent: XmlContent): boolean {
    const root = this.extractRootElement(fileContent)
    return Object.entries(root)
      .filter(([key]) => !key.startsWith(ATTRIBUTE_PREFIX))
      .every(
        ([, value]) => !value || (Array.isArray(value) && value.length === 0)
      )
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
    return this.extractor
      .getSubTypes(baseContent)
      .filter(subType => this.extractor.isTypePackageable(subType))
      .reduce((manifest, subType) => {
        const baseMeta = this.extractor.extractForSubType(baseContent, subType)
        const targetMeta = this.extractor.extractForSubType(
          targetContent,
          subType
        )
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
  constructor(private extractor: MetadataExtractor) {}

  generatePartialJson(
    fromContent: XmlContent,
    toContent: XmlContent
  ): XmlContent {
    return this.extractor.getSubTypes(toContent).reduce((acc, subType) => {
      const fromMeta = this.extractor.extractForSubType(fromContent, subType)
      const toMeta = this.extractor.extractForSubType(toContent, subType)
      const keyField = this.extractor.getKeyFieldDefinition(subType)

      const partialContentBuilder = isUndefined(keyField)
        ? this.getPartialContentWithoutKey
        : this.getPartialContentWithKey

      this.extractor.extractRootElement(acc)[subType] = partialContentBuilder(
        fromMeta,
        toMeta
      )

      return acc
    }, structuredClone(toContent))
  }

  private getPartialContentWithoutKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    return isEqual(fromMeta, toMeta) ? [] : toMeta
  }

  private getPartialContentWithKey(
    fromMeta: XmlContent[],
    toMeta: XmlContent[]
  ): XmlContent[] {
    return differenceWith(toMeta, fromMeta, isEqual)
  }
}
