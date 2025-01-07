'use strict'

import type { Metadata } from '../types/metadata.js'

export interface MetadataRepository {
  has(path: string): boolean
  get(path: string): Metadata | undefined
  getFullyQualifiedName(path: string): string
  values(): Metadata[]
}
