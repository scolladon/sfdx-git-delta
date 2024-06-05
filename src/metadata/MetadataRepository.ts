'use strict'

import type { Metadata, SharedFileMetadata } from '../types/metadata'

export interface MetadataRepository {
  has(path: string): boolean
  get(path: string): Metadata | undefined
  getFullyQualifiedName(path: string): string
  values(): Metadata[]
  isPackable(type: string): boolean
  getInFileAttributes(): Map<string, SharedFileMetadata>
  getSharedFolderMetadata(): Map<string, string>
}
