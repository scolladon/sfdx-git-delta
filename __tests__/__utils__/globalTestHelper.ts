'use strict'
import { MetadataRepository } from '../../src/metadata/MetadataRepository'
import {
  getDefinition,
  getLatestSupportedVersion,
} from '../../src/metadata/metadataManager'
import type { Work } from '../../src/types/work'

require('ts-node/register')

export const getGlobalMetadata = async (): Promise<MetadataRepository> => {
  const apiVersion: number = await getLatestSupportedVersion()
  const metadata: MetadataRepository = await getDefinition(apiVersion)
  return metadata
}

export const getWork = (): Work => ({
  diffs: {
    package: new Map<string, Set<string>>(),
    destructiveChanges: new Map<string, Set<string>>(),
  },
  config: {
    source: './',
    output: 'output',
    generateDelta: true,
    to: '',
    from: '',
    ignore: '',
    ignoreDestructive: '',
    apiVersion: -1,
    repo: '',
    ignoreWhitespace: false,
    include: '',
    includeDestructive: '',
  },
  warnings: [],
})
