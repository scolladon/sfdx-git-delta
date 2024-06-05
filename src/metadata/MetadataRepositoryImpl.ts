'use strict'

import { parse } from 'path'

import { DOT, PATH_SEP } from '../constant/fsConstants'
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
} from '../constant/metadataConstants'
import type {
  BaseMetadata,
  Metadata,
  SharedFileMetadata,
  SharedFolderMetadata,
} from '../types/metadata'

import { MetadataRepository } from './MetadataRepository'

export class MetadataRepositoryImpl implements MetadataRepository {
  private static instance: MetadataRepository | null

  public static getInstance(metadatas: Metadata[]): MetadataRepository {
    if (!MetadataRepositoryImpl.instance) {
      MetadataRepositoryImpl.instance = new MetadataRepositoryImpl(metadatas)
    }

    return MetadataRepositoryImpl.instance
  }

  public static resetForTest() {
    MetadataRepositoryImpl.instance = null
  }

  protected static inFileMetadata = new Map<string, SharedFileMetadata>()
  protected static sharedFolderMetadata = new Map<string, string>()
  protected readonly metadataPerExt: Map<string, Metadata>
  protected readonly metadataPerDir: Map<string, Metadata>

  private constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly metadatas: Metadata[]
  ) {
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

  isPackable(type: string): boolean {
    return (
      Array.from(this.getInFileAttributes().values()).find(
        (inFileDef: SharedFileMetadata) => inFileDef.xmlName === type
      )?.excluded !== true
    )
  }

  getInFileAttributes(): Map<string, SharedFileMetadata> {
    return MetadataRepositoryImpl.inFileMetadata.size
      ? MetadataRepositoryImpl.inFileMetadata
      : this.metadatas
          .filter((meta: Metadata) => meta.xmlTag)
          .reduce(
            (acc: Map<string, SharedFileMetadata>, meta: Metadata) =>
              acc.set(meta.xmlTag!, {
                xmlName: meta.xmlName,
                key: meta.key,
                excluded: !!meta.excluded,
              } as SharedFileMetadata),
            MetadataRepositoryImpl.inFileMetadata
          )
  }

  getSharedFolderMetadata(): Map<string, string> {
    return MetadataRepositoryImpl.sharedFolderMetadata.size
      ? MetadataRepositoryImpl.sharedFolderMetadata
      : this.metadatas
          .filter((meta: Metadata) => meta.content)
          .flatMap(
            (elem: SharedFolderMetadata): BaseMetadata[] => elem.content!
          )
          .reduce(
            (acc: Map<string, string>, val: BaseMetadata) =>
              acc.set(val!.suffix!, val!.xmlName!),
            MetadataRepositoryImpl.sharedFolderMetadata
          )
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
