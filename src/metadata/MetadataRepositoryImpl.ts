'use strict'

import { parse } from 'path'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import {
  CUSTOM_APPLICATION_SUFFIX,
  CUSTOM_METADATA_SUFFIX,
  EMAIL_SERVICES_FUNCTION_SUFFIX,
  METAFILE_SUFFIX,
  OBJECT_TRANSLATION_TYPE,
  OBJECT_TYPE,
  SHARING_RULE_TYPE,
  SUB_OBJECT_TYPES,
  TERRITORY_MODEL_TYPE,
  WORKFLOW_TYPE,
} from '../constant/metadataConstants.js'
import type { Metadata } from '../types/metadata.js'

import { MetadataRepository } from './MetadataRepository.js'

export class MetadataRepositoryImpl implements MetadataRepository {
  protected readonly metadataPerExt: Map<string, Metadata>
  protected readonly metadataPerDir: Map<string, Metadata>
  constructor(protected readonly metadatas: Metadata[]) {
    this.metadataPerExt = new Map<string, Metadata>()
    this.metadataPerDir = new Map<string, Metadata>()

    this.metadatas.forEach(metadata => {
      this.addSuffix(metadata)
      this.addFolder(metadata)
    })
  }

  protected addSuffix(metadata: Metadata) {
    if (metadata.suffix) {
      if (this.metadataPerExt.has(metadata.suffix)) {
        MetadataRepositoryImpl.UNSAFE_EXTENSION.add(metadata.suffix)
      } else {
        this.metadataPerExt.set(metadata.suffix, metadata)
      }
    }
    this.addSharedFolderSuffix(metadata)
  }

  protected addSharedFolderSuffix(metadata: Metadata) {
    if (metadata.content) {
      const metadataWithoutContent = {
        ...metadata,
        content: undefined,
      }
      for (const sharedFolderMetadataDef of metadata.content) {
        this.addSuffix({
          ...metadataWithoutContent,
          suffix: sharedFolderMetadataDef.suffix,
        } as unknown as Metadata)
      }
    }
  }

  protected addFolder(metadata: Metadata) {
    if (metadata.directoryName) {
      this.metadataPerDir.set(metadata.directoryName, metadata)
    }
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
    for (const part of parts) {
      metadata = this.metadataPerDir.get(part) ?? metadata
      if (
        metadata &&
        !MetadataRepositoryImpl.TYPES_WITH_SUB_TYPES.has(metadata.xmlName!)
      ) {
        break
      }
    }
    return metadata
  }

  public getFullyQualifiedName(path: string): string {
    let fullyQualifiedName = parse(path).base
    const type = this.get(path)
    if (type && MetadataRepositoryImpl.COMPOSED_TYPES.has(type.xmlName!)) {
      const parentType = path
        .split(PATH_SEP)
        .find(part => this.metadataPerDir.has(part))!
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
    EMAIL_SERVICES_FUNCTION_SUFFIX,
    CUSTOM_METADATA_SUFFIX,
  ])

  private static COMPOSED_TYPES = new Set([
    OBJECT_TYPE,
    OBJECT_TRANSLATION_TYPE,
    WORKFLOW_TYPE,
    SHARING_RULE_TYPE,
    ...SUB_OBJECT_TYPES,
  ])
}
