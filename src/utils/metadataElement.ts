'use strict'
import { parse } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import { META_REGEX, METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import {
  getInFileAttributes,
  getSharedFolderMetadata,
} from '../metadata/metadataManager.js'
import type { Metadata, SharedFileMetadata } from '../types/metadata.js'

export class MetadataElement {
  public readonly fullPath: string
  public readonly basePath: string
  public readonly parts: readonly string[]
  public readonly extension: string
  public readonly parentFolder: string
  public readonly isMetaFile: boolean

  private constructor(
    fullPath: string,
    private readonly metadataDef: Metadata,
    private readonly metadataRepo: MetadataRepository,
    private readonly anchorIndex: number
  ) {
    this.fullPath = fullPath
    this.isMetaFile = fullPath.endsWith(METAFILE_SUFFIX)
    this.basePath =
      this.isMetaFile && metadataDef.metaFile
        ? fullPath.replace(METAFILE_SUFFIX, '')
        : fullPath

    this.parts = fullPath.split(PATH_SEP)

    const parsed = parse(this.basePath)
    this.extension = parsed.base
      .replace(METAFILE_SUFFIX, '')
      .split(DOT)
      .pop() as string
    this.parentFolder = parsed.dir.split(PATH_SEP).slice(-1)[0]
  }

  static fromPath(
    path: string,
    metadataDef: Metadata,
    metadataRepo: MetadataRepository
  ): MetadataElement | null {
    const parts = path.split(PATH_SEP)
    const dirIndex = parts.lastIndexOf(metadataDef.directoryName)

    if (dirIndex < 0) {
      return null
    }

    const isFolder = dirIndex + 1 < parts.length - 1
    const anchorIndex = isFolder ? dirIndex + 1 : dirIndex

    return new MetadataElement(path, metadataDef, metadataRepo, anchorIndex)
  }

  static fromScan(
    path: string,
    metadataDef: Metadata,
    metadataRepo: MetadataRepository,
    anchorIndex: number
  ): MetadataElement {
    return new MetadataElement(path, metadataDef, metadataRepo, anchorIndex)
  }

  get type(): Metadata {
    return this.metadataDef
  }

  get componentName(): string {
    return parse(this.parts[this.parts.length - 1].replace(META_REGEX, '')).name
  }

  get parentName(): string {
    const dirIndex = (this.parts as string[]).lastIndexOf(
      this.metadataDef.directoryName
    )
    if (dirIndex >= 1) {
      return this.parts[dirIndex - 1]
    }
    // Fallback for scan: parent is before the anchor's directory
    if (this.anchorIndex >= 2) {
      return this.parts[this.anchorIndex - 2] ?? ''
    }
    return ''
  }

  get componentBasePath(): string {
    return (this.parts as string[])
      .slice(0, this.anchorIndex + 1)
      .join(PATH_SEP)
  }

  get typeDirectoryPath(): string {
    const dirIndex = (this.parts as string[]).lastIndexOf(
      this.metadataDef.directoryName
    )
    if (dirIndex >= 0) {
      return (this.parts as string[]).slice(0, dirIndex + 1).join(PATH_SEP)
    }
    // Fallback for scan: go up one from anchor
    return (this.parts as string[]).slice(0, this.anchorIndex).join(PATH_SEP)
  }

  get pathAfterType(): string[] {
    const dirIndex = (this.parts as string[]).lastIndexOf(
      this.metadataDef.directoryName
    )
    if (dirIndex >= 0) {
      return (this.parts as string[]).slice(dirIndex + 1)
    }
    // Fallback for scan
    return (this.parts as string[]).slice(this.anchorIndex)
  }

  getParentType(): Metadata | undefined {
    if (!this.metadataDef.parentXmlName) {
      return undefined
    }
    return this.metadataRepo
      .values()
      .find(m => m.xmlName === this.metadataDef.parentXmlName)
  }

  getSharedFolderMetadata(): Map<string, string> {
    return getSharedFolderMetadata(this.metadataRepo)
  }

  getInFileAttributes(): Map<string, SharedFileMetadata> {
    return getInFileAttributes(this.metadataRepo)
  }
}
