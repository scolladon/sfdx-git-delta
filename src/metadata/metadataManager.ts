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

let inFileMetadata = new Map<string, SharedFileMetadata>()
let sharedFolderMetadata = new Map<string, string>()

// For testing - clears the cached metadata maps
export const resetMetadataCache = (): void => {
  inFileMetadata = new Map()
  sharedFolderMetadata = new Map()
}

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
  const sdrAdapter = new SDRMetadataAdapter()
  const standardMetadata = merger.merge(sdrAdapter.toInternalMetadata())

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
      const additionalMetadata = JSON.parse(content)
      if (!Array.isArray(additionalMetadata)) {
        throw new Error('Content must be a JSON array')
      }
      const invalidEntries = additionalMetadata.filter(
        (entry: Metadata) => !entry.xmlName
      )
      if (invalidEntries.length > 0) {
        throw new Error('Each metadata entry must have an xmlName property')
      }
      finalMetadata = fullMerger.merge(additionalMetadata as Metadata[])
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
        .filter((meta: Metadata) => meta.xmlTag)
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
