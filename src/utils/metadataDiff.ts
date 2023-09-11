/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict'

import {
  asArray,
  parseXmlFileToJson,
  convertJsonToXml,
  ATTRIBUTE_PREFIX,
} from './fxpHelper'
import { isEqual } from 'lodash'
import { fillPackageWithParameter } from './packageHelper'
import { Manifest } from '../types/work'
import { Config } from '../types/config'
import { MetadataRepository, SharedFileMetadata } from '../types/metadata'

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
    store.get(attributes.get(subType)!.xmlName)?.has(member)

const selectKey =
  (attributes: Map<string, SharedFileMetadata>) =>
  (type: string) =>
  (elem: any) =>
    elem?.[attributes.get(type)!.key!]

// Metadata JSON structure functional area
const getRootMetadata = (fileContent: any): any =>
  Object.values(fileContent)?.[1] ?? {}

const getSubTypeTags =
  (attributes: Map<string, SharedFileMetadata>) => (fileContent: any) =>
    Object.keys(getRootMetadata(fileContent)).filter(tag => attributes.has(tag))

const extractMetadataForSubtype =
  (fileContent: any) =>
  (subType: string): string[] =>
    asArray(getRootMetadata(fileContent)?.[subType])

const isEmpty = (fileContent: any) =>
  Object.entries(getRootMetadata(fileContent))
    .filter(([key]) => !key.startsWith(ATTRIBUTE_PREFIX))
    .every(([, value]) => Array.isArray(value) && value.length === 0)

// Diff processing functional area
const compareContent =
  (attributes: Map<string, SharedFileMetadata>) =>
  (
    contentAtRef: any,
    otherContent: any,
    // eslint-disable-next-line no-unused-vars
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
    baseContent: any,
    otherContent: any,
    // eslint-disable-next-line no-unused-vars
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
    // eslint-disable-next-line no-unused-vars
    predicat: (arg0: any, arg1: string, arg2: string) => boolean,
    otherMeta: string[],
    attributes: Map<string, SharedFileMetadata>
  ) =>
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

// Partial JSON generation functional are
// Side effect on jsonContent
const generatePartialJSON =
  (attributes: Map<string, SharedFileMetadata>) =>
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
    }, jsonContent)
  }

export default class MetadataDiff {
  protected readonly configTo: Config
  protected readonly configFrom: Config
  protected toContent: any
  protected add!: Manifest
  constructor(
    protected readonly config: Config,
    protected readonly metadata: MetadataRepository,
    protected readonly attributes: Map<string, SharedFileMetadata>
  ) {
    this.config = config
    this.metadata = metadata
    this.attributes = attributes
    this.configTo = {
      repo: this.config.repo,
      to: this.config.to,
    } as Config
    this.configFrom = {
      repo: this.config.repo,
      to: this.config.from,
    } as Config
  }

  public async compare(path: string) {
    this.toContent = await parseXmlFileToJson(path, this.configTo)
    const fromContent = await parseXmlFileToJson(path, this.configFrom)

    const diff = compareContent(this.attributes)

    // Added or Modified
    this.add = diff(
      this.toContent,
      fromContent,
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
