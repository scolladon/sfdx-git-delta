'use strict'

import { Metadata } from '../types/metadata'

export interface MetadataRepository {
  has(path: string): boolean
  get(path: string): Metadata | undefined
  getFullyQualifiedName(path: string): string
  values(): Metadata[]
}
