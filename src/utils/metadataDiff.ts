'use strict'

import { differenceWith, isEqual, isUndefined } from 'lodash'

import type { Config } from '../types/config'
import type { SharedFileMetadata } from '../types/metadata'
import type { Manifest } from '../types/work'

import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  asArray,
  convertJsonToXml,
  parseXmlFileToJson,
} from './fxpHelper'
import { fillPackageWithParameter } from './packageHelper'

type DiffResult = {
  added: Manifest
  deleted: Manifest
}

type PrunedContent = {
  xmlContent: string
  isEmpty: boolean
}

class MetadataExtractor {
  constructor(private attributes: Map<string, SharedFileMetadata>) {}

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public getRoot(fileContent: any): any {
    return (
      fileContent[
        Object.keys(fileContent).find(
          attr => attr !== XML_HEADER_ATTRIBUTE_KEY
        )!
      ] ?? {}
    )
  }

  isTypePackageable(subType: string): unknown {
    return this.attributes.get(subType)?.excluded !== true
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public getSubTypes(fileContent: any): string[] {
    const root = this.getRoot(fileContent)
    return Object.keys(root).filter(tag => this.attributes.has(tag))
  }

  getXmlName(subType: string) {
    return this.attributes.get(subType)?.xmlName!
  }

  public getKeySelector(subType: string) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return (elem: any) => elem[this.attributes.get(subType)?.key!]
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public extractForSubType(fileContent: any, subType: string): any[] {
    return asArray(this.getRoot(fileContent)?.[subType] ?? [])
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public isContentEmpty(fileContent: any): boolean {
    const root = this.getRoot(fileContent)
    return Object.entries(root)
      .filter(([key]) => !key.startsWith(ATTRIBUTE_PREFIX))
      .every(([, value]) => Array.isArray(value) && value.length === 0)
  }
}

class MetadataComparator {
  constructor(private extractor: MetadataExtractor) {}

  public compare(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    baseContent: any,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    targetContent: any,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    predicate: (base: any[], type: string, key: string) => boolean
  ): Manifest {
    const subTypes = this.extractor.getSubTypes(baseContent)

    return subTypes
      .filter(subType => this.extractor.isTypePackageable(subType))
      .reduce((manifest, subType) => {
        const baseMeta = this.extractor.extractForSubType(baseContent, subType)
        const targetMeta = this.extractor.extractForSubType(
          targetContent,
          subType
        )

        const keySelector = this.extractor.getKeySelector(subType)
        const xmlName = this.extractor.getXmlName(subType)
        for (const elem of baseMeta) {
          if (predicate(targetMeta, subType, elem)) {
            fillPackageWithParameter({
              store: manifest,
              type: xmlName,
              member: keySelector(elem),
            })
          }
        }
        return manifest
      }, new Map())
  }
}

class JsonTransformer {
  constructor(private attributes: Map<string, SharedFileMetadata>) {}

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  public generatePartialJson(fromContent: any, toContent: any): any {
    const metadataExtractor = new MetadataExtractor(this.attributes)
    const subTypes = metadataExtractor.getSubTypes(toContent)
    return subTypes.reduce((acc, subType) => {
      const fromMeta = metadataExtractor.extractForSubType(fromContent, subType)
      const toMeta = metadataExtractor.extractForSubType(toContent, subType)

      const rootMetadata = metadataExtractor.getRoot(acc)

      rootMetadata[subType] = this.getPartialContent(fromMeta, toMeta, subType)
      return acc
    }, structuredClone(toContent))
  }

  private getPartialContent(
    fromMeta: string[],
    toMeta: string[],
    subType: string
  ): string[] {
    const keyField = this.attributes.get(subType)?.key
    if (isUndefined(keyField)) {
      return isEqual(fromMeta, toMeta) ? [] : toMeta
    }
    return differenceWith(toMeta, fromMeta, isEqual)
  }
}

export default class MetadataDiff {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private toContent: any
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private fromContent: any
  private added!: Manifest
  private metadataExtractor!: MetadataExtractor

  constructor(
    private config: Config,
    private attributes: Map<string, SharedFileMetadata>
  ) {
    this.metadataExtractor = new MetadataExtractor(this.attributes)
  }

  public async compare(path: string): Promise<DiffResult> {
    this.toContent = await parseXmlFileToJson(
      { path, oid: this.config.to },
      this.config
    )
    this.fromContent = await parseXmlFileToJson(
      { path, oid: this.config.from },
      this.config
    )

    const comparator = new MetadataComparator(this.metadataExtractor)
    this.added = comparator.compare(
      this.toContent,
      this.fromContent,
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      (meta, type, elem: any) => {
        const keySelector = this.metadataExtractor.getKeySelector(type)
        const elemKey = keySelector(elem)
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const match = meta.find((el: any) => keySelector(el) === elemKey)
        return !match || !isEqual(match, elem)
      }
    )

    const deleted = comparator.compare(
      this.fromContent,
      this.toContent,
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      (meta, type, elem: any) => {
        const keySelector = this.metadataExtractor.getKeySelector(type)
        const elemKey = keySelector(elem)
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        return !meta.some((el: any) => keySelector(el) === elemKey)
      }
    )

    return { added: this.added, deleted }
  }

  public prune(): PrunedContent {
    const transformer = new JsonTransformer(this.attributes)
    const prunedContent = transformer.generatePartialJson(
      this.fromContent,
      this.toContent
    )

    return {
      xmlContent: convertJsonToXml(prunedContent),
      isEmpty: this.metadataExtractor.isContentEmpty(prunedContent),
    }
  }
}
