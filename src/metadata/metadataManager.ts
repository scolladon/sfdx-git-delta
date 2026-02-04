'use strict'
import type {
  BaseMetadata,
  Metadata,
  SharedFileMetadata,
  SharedFolderMetadata,
} from '../types/metadata.js'
import { readFile } from '../utils/fsUtils.js'

import { MetadataRepository } from './MetadataRepository.js'
import { MetadataRepositoryImpl } from './MetadataRepositoryImpl.js'

const inFileMetadata = new Map<string, SharedFileMetadata>()
const sharedFolderMetadata = new Map<string, string>()

export const getLatestSupportedVersion = async () => {
  return parseInt(await SDRMetadataAdapter.getLatestApiVersion())
}

import type { Config } from '../types/config.js'
import internalRegistry from './internalRegistry.js'
import { MetadataDefinitionMerger } from './metadataDefinitionMerger.js'
import { SDRMetadataAdapter } from './sdrMetadataAdapter.js'

export const getDefinition = async (
  config: Pick<Config, 'apiVersion' | 'additionalMetadataRegistryPath'>
): Promise<MetadataRepository> => {
  const { additionalMetadataRegistryPath } = config
  // 1. Initialize with Internal Registry (Priority 1)
  // We use Internal as base so it has highest priority in the merger logic (merger keeps existingXmlNames)
  const merger = new MetadataDefinitionMerger(internalRegistry)

  // 2. Merge SDR Metadata (Priority 2)
  const standardMetadata = merger.merge(SDRMetadataAdapter.toInternalMetadata())

  // 3. Add entries that can't go through the merger due to xmlName collision.
  // CustomObjectTranslation needs two entries with different suffixes:
  // - fieldTranslation (in internalRegistry) for child file handling
  // - objectTranslation (below) for parent file with pruneOnly
  const postMergeEntries: Metadata[] = [
    {
      directoryName: 'objectTranslations',
      inFolder: false,
      metaFile: false,
      suffix: 'objectTranslation',
      xmlName: 'CustomObjectTranslation',
      pruneOnly: true,
    },
  ]

  let finalMetadata = [...standardMetadata, ...postMergeEntries]

  if (additionalMetadataRegistryPath) {
    const fullMerger = new MetadataDefinitionMerger(finalMetadata)
    const content = await readFile(additionalMetadataRegistryPath)
    try {
      const additionalMetadata = JSON.parse(content) as Metadata[]
      finalMetadata = fullMerger.merge(additionalMetadata)
    } catch (err) {
      throw new Error(
        `Unable to parse the additional metadata registry file '${additionalMetadataRegistryPath}'. Caused by: ${err}`
      )
    }
  }

  const metadataRepository: MetadataRepository = new MetadataRepositoryImpl(
    finalMetadata
  )
  return metadataRepository
}

export const isPackable = (type: string) =>
  Array.from(inFileMetadata.values()).find(
    (inFileDef: SharedFileMetadata) => inFileDef.xmlName === type
  )?.excluded !== true

export const getInFileAttributes = (metadata: MetadataRepository) =>
  inFileMetadata.size
    ? inFileMetadata
    : metadata
        .values()
        .filter((meta: Metadata) => {
          if (!meta.xmlTag) return false
          // Atomic types: Filter out completely to enforce Generic Diff (Full Content)
          const atomicTypes = new Set([
            'Profile',
            'CustomObjectTranslation',
            'Territory2Model',
          ])
          return (
            !atomicTypes.has(meta.parentXmlName || '') &&
            !atomicTypes.has(meta.xmlName || '')
          )
        })
        .reduce((acc: Map<string, SharedFileMetadata>, meta: Metadata) => {
          // Granular Excluded: Include but mark excluded to prevent packing
          const granularExcludedTypes = new Set([
            'Translations',
            'StandardValueSetTranslation',
            'GlobalValueSetTranslation',
          ])
          const isExcluded =
            granularExcludedTypes.has(meta.parentXmlName || '') ||
            granularExcludedTypes.has(meta.xmlName || '')

          acc.set(meta.xmlTag!, {
            xmlName: meta.xmlName,
            key: meta.key,
            excluded: isExcluded || !!meta.excluded,
          } as SharedFileMetadata)
          return acc
        }, inFileMetadata)

export const getSharedFolderMetadata = (metadata: MetadataRepository) =>
  sharedFolderMetadata.size
    ? sharedFolderMetadata
    : metadata
        .values()
        .filter((meta: Metadata) => meta.content)
        .flatMap((elem: SharedFolderMetadata): BaseMetadata[] => elem.content!)
        .reduce(
          (acc: Map<string, string>, val: BaseMetadata) =>
            acc.set(val!.suffix!, val!.xmlName!),
          sharedFolderMetadata
        )
