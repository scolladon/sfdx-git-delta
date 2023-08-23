'use strict'
import { MetadataRepository } from '../types/metadata'
import { OBJECT_TYPE, TERRITORY_MODEL_TYPE } from '../utils/metadataConstants'
import { sep } from 'path'

const haveSubTypes = [OBJECT_TYPE, TERRITORY_MODEL_TYPE, '']

export const getType = (line: string, metadata: MetadataRepository): string =>
  line.split(sep).reduce((acc, value, _, arr) => {
    acc = metadata.has(value) ? value : acc
    if (!haveSubTypes.includes(acc)) arr.splice(1)
    return acc
  }, '')
