'use strict'
import type {
  BaseMetadata,
  Metadata,
  SharedFileMetadata,
  SharedFolderMetadata,
} from '../types/metadata.js'

import { MetadataRepository } from './MetadataRepository.js'
import { MetadataRepositoryImpl } from './MetadataRepositoryImpl.js'

const inFileMetadata = new Map<string, SharedFileMetadata>()
const sharedFolderMetadata = new Map<string, string>()

const earliestVersion: number = 46
const latestVersion: number = 63

export const getLatestSupportedVersion = () => {
  return latestVersion - 1
}

export const isVersionSupported = (version: number | undefined) => {
  return (
    Number.isInteger(version) &&
    version! >= earliestVersion &&
    version! <= latestVersion
  )
}

export const getDefinition = async (
  apiVersion: number | undefined
): Promise<MetadataRepository> => {
  const version = isVersionSupported(apiVersion)
    ? apiVersion
    : getLatestSupportedVersion()
  const { default: metadataVersion } = await import(`./v${version}.js`)

  const metadataRepository: MetadataRepository = new MetadataRepositoryImpl(
    metadataVersion
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
        .reduce(
          (acc: Map<string, SharedFileMetadata>, meta: Metadata) =>
            acc.set(meta.xmlTag!, {
              xmlName: meta.xmlName,
              key: meta.key,
              excluded: !!meta.excluded,
            } as SharedFileMetadata),
          inFileMetadata
        )

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
