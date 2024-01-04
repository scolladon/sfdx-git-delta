'use strict'
import { MetadataRepository } from '../types/metadata'
import { sep } from 'path'

export const getType = (line: string, metadata: MetadataRepository): string =>
  line
    .split(sep)
    .reverse()
    .find(part => metadata.has(part)) ?? ''
