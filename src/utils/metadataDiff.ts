'use strict'

import lodash from 'lodash'

import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'
import type { SharedFileMetadata } from '../types/metadata.js'
import type { Manifest } from '../types/work.js'

import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  asArray,
  convertJsonToXml,
  parseXmlFileToJson,
} from './fxpHelper.js'
import { fillPackageWithParameter } from './packageHelper.js'

const { isEqual } = lodash

type ManifestTypeMember = {
  type: string
  member: string
}

// Store functional area
// Side effect on store
const addToStore =
  (store: Manifest) =>
  ({ type, member }: ManifestTypeMember): Manifest => {
    fillPackageWithParameter({ store, type, member })
    return store
  }

const hasMember =
  (store: Manifest) =>
  (attributes: Map<string, SharedFileMetadata>) =>
  (subType: string) =>
  (member: string) =>
    attributes.has(subType) &&
    store.get(attributes.get(subType)!.xmlName!)?.has(member)

const selectKey =
  (attributes: Map<string, SharedFileMetadata>) =>
  (type: string) =>
  // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
  (elem: any) =>
    elem?.[attributes.get(type)!.key!]

// Metadata JSON structure functional area
// biome-ignore lint/suspicious/noExplicitAny: Any is expected here
const getRootMetadata = (fileContent: any): any =>
  fileContent[
    Object.keys(fileContent).find(
      attribute => attribute !== XML_HEADER_ATTRIBUTE_KEY
    ) as string
  ] ?? {}

const getSubTypeTags =
  // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
  (attributes: Map<string, SharedFileMetadata>) => (fileContent: any) =>
    Object.keys(getRootMetadata(fileContent)).filter(tag => attributes.has(tag))

const extractMetadataForSubtype =
  (
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    fileContent: any
  ) =>
  (subType: string): string[] =>
    asArray(getRootMetadata(fileContent)?.[subType])

// biome-ignore lint/suspicious/noExplicitAny: Any is expected here
const isEmpty = (fileContent: any) =>
  Object.entries(getRootMetadata(fileContent))
    .filter(([key]) => !key.startsWith(ATTRIBUTE_PREFIX))
    .every(([, value]) => Array.isArray(value) && value.length === 0)

// Diff processing functional area
const compareContent =
  (attributes: Map<string, SharedFileMetadata>) =>
  (
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    contentAtRef: any,
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    otherContent: any,
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    predicat: (arg0: any, arg1: string, arg2: string) => boolean
  ): Manifest => {
    const v: ManifestTypeMember[] = getSubTypeTags(attributes)(
      contentAtRef
    ).flatMap(
      processMetadataForSubType(
        contentAtRef,
        otherContent,
        predicat,
        attributes
      )
    )
    const store: Manifest = new Map()
    v.forEach((nameByType: ManifestTypeMember) => addToStore(store)(nameByType))
    return store
  }

const processMetadataForSubType =
  (
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    baseContent: any,
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    otherContent: any,
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    predicat: (arg0: any, arg1: string, arg2: string) => boolean,
    attributes: Map<string, SharedFileMetadata>
  ) =>
  (subType: string): ManifestTypeMember[] => {
    const baseMeta = extractMetadataForSubtype(baseContent)(subType)
    const otherMeta = extractMetadataForSubtype(otherContent)(subType)
    const processElement = getElementProcessor(
      subType,
      predicat,
      otherMeta,
      attributes
    )
    return baseMeta
      .map(processElement)
      .filter(x => x !== undefined) as ManifestTypeMember[]
  }

const getElementProcessor =
  (
    type: string,
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    predicat: (arg0: any, arg1: string, arg2: string) => boolean,
    otherMeta: string[],
    attributes: Map<string, SharedFileMetadata>
  ) =>
  // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
  (elem: any) => {
    let metadataMember
    if (predicat(otherMeta, type, elem)) {
      metadataMember = {
        type: attributes.get(type)!.xmlName,
        member: selectKey(attributes)(type)(elem),
      }
    }
    return metadataMember
  }

// Partial JSON generation functional area
// Side effect on jsonContent
const generatePartialJSON =
  (attributes: Map<string, SharedFileMetadata>) =>
  // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
  (jsonContent: any) =>
  (store: Manifest) => {
    const extract = extractMetadataForSubtype(jsonContent)
    const storeHasMember = hasMember(store)(attributes)
    return getSubTypeTags(attributes)(jsonContent).reduce((acc, subType) => {
      const meta = extract(subType)
      const storeHasMemberForType = storeHasMember(subType)
      const key = selectKey(attributes)(subType)
      const rootMetadata = getRootMetadata(acc)
      rootMetadata[subType] = meta.filter(elem =>
        storeHasMemberForType(key(elem))
      )
      return acc
    }, structuredClone(jsonContent))
  }

export default class MetadataDiff {
  // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
  protected toContent: any
  protected add!: Manifest
  constructor(
    protected readonly config: Config,
    protected readonly metadata: MetadataRepository,
    protected readonly attributes: Map<string, SharedFileMetadata>
  ) {}

  public async compare(path: string) {
    this.toContent = await parseXmlFileToJson(
      { path, oid: this.config.to },
      this.config
    )
    const fromContent = await parseXmlFileToJson(
      { path, oid: this.config.from },
      this.config
    )

    const diff = compareContent(this.attributes)

    // Added or Modified
    this.add = diff(
      this.toContent,
      fromContent,
      // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
      (meta: any[], type: string, elem: string) => {
        const key = selectKey(this.attributes)(type)
        const match = meta.find((el: string) => key(el) === key(elem))
        return !match || !isEqual(match, elem)
      }
    )

    // Will be done when not needed
    // Deleted
    const del = diff(
      fromContent,
      this.toContent,
      // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
      (meta: any[], type: string, elem: string) => {
        const key = selectKey(this.attributes)(type)
        return !meta.some((el: string) => key(el) === key(elem))
      }
    )

    return {
      added: this.add,
      deleted: del,
    }
  }

  public prune() {
    const prunedContent = generatePartialJSON(this.attributes)(this.toContent)(
      this.add
    )
    return {
      xmlContent: convertJsonToXml(prunedContent),
      isEmpty: isEmpty(prunedContent),
    }
  }
}
