'use strict'

import { parse } from 'path'

import { DOT, PATH_SEP } from '../constant/fsConstants'
import {
  CUSTOM_APPLICATION_SUFFIX,
  EMAILSERVICESFUNCTION_SUFFIX,
  EXPERIENCEBUNDLE_SUFFIX,
  METAFILE_SUFFIX,
  MODERATION_RULE_SUFFIX,
  OBJECT_TRANSLATION_TYPE,
  OBJECT_TYPE,
  RESTRICTION_RULE_SUFFIX,
  SHARING_RULE_TYPE,
  SITE_SUFFIX,
  SITEDOTCOM_SUFFIX,
  SUB_OBJECT_TYPES,
  TERRITORY_MODEL_TYPE,
  WORKFLOW_RULE_SUFFIX,
  WORKFLOW_TYPE,
} from '../constant/metadataConstants'
import type { Metadata } from '../types/metadata'

import { MetadataRepository } from './MetadataRepository'

export class MetadataRepositoryImpl implements MetadataRepository {
  protected readonly metadataPerExt: Map<string, Metadata>
  protected readonly metadataPerDir: Map<string, Metadata>
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly metadatas: Metadata[]
  ) {
    this.metadataPerExt = new Map<string, Metadata>()
    this.metadataPerDir = new Map<string, Metadata>()

    this.metadatas.forEach(metadata => {
      if (metadata.suffix) {
        this.metadataPerExt.set(metadata.suffix, metadata)
      }
      this.metadataPerDir.set(metadata.directoryName, metadata)
    })
  }

  public has(path: string): boolean {
    return !!this.get(path)
  }

  public get(path: string): Metadata | undefined {
    const parts = path.split(PATH_SEP)
    const metadata = this.searchByExtension(parts)
    return metadata ?? this.searchByDirectory(parts)
  }

  protected searchByExtension(parts: string[]): Metadata | undefined {
    const extension = parse(
      parts[parts.length - 1].replace(METAFILE_SUFFIX, '')
    ).ext.replace(DOT, '')

    if (MetadataRepositoryImpl.UNSAFE_EXTENSION.has(extension)) {
      return
    }
    return this.metadataPerExt.get(extension)
  }

  protected searchByDirectory(parts: string[]): Metadata | undefined {
    let metadata: Metadata | undefined
    parts.find(part => {
      metadata = this.metadataPerDir.get(part) ?? metadata
      return (
        !!metadata &&
        !MetadataRepositoryImpl.TYPES_WITH_SUB_TYPES.has(metadata.xmlName!)
      )
    })
    return metadata
  }

  public getFullyQualifiedName(path: string): string {
    const type = this.get(path)
    let fullyQualifiedName = parse(path).base
    if (type && MetadataRepositoryImpl.COMPOSED_TYPES.has(type.xmlName!)) {
      const parentType = path
        .split(PATH_SEP)
        .find(part => this.metadataPerDir.get(part))!
      fullyQualifiedName = path
        .slice(path.indexOf(parentType))
        .replace(new RegExp(PATH_SEP, 'g'), '')
    }
    return fullyQualifiedName
  }

  public values(): Metadata[] {
    return this.metadatas
  }

  private static TYPES_WITH_SUB_TYPES = new Set([
    OBJECT_TYPE,
    TERRITORY_MODEL_TYPE,
    WORKFLOW_TYPE,
    SHARING_RULE_TYPE,
    '',
  ])

  private static UNSAFE_EXTENSION = new Set([
    CUSTOM_APPLICATION_SUFFIX,
    EMAILSERVICESFUNCTION_SUFFIX,
    EXPERIENCEBUNDLE_SUFFIX,
    MODERATION_RULE_SUFFIX,
    RESTRICTION_RULE_SUFFIX,
    SITE_SUFFIX,
    SITEDOTCOM_SUFFIX,
    WORKFLOW_RULE_SUFFIX,
  ])

  private static COMPOSED_TYPES = new Set([
    OBJECT_TYPE,
    OBJECT_TRANSLATION_TYPE,
    WORKFLOW_TYPE,
    SHARING_RULE_TYPE,
    ...SUB_OBJECT_TYPES,
  ])
}
