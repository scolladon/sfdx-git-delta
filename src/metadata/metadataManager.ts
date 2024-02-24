'use strict'
import { resolve } from 'path'

import { readFile, readdir } from 'fs-extra'

import type {
  BaseMetadata,
  Metadata,
  SharedFileMetadata,
  SharedFolderMetadata,
} from '../types/metadata'

import { MetadataRepository } from './MetadataRepository'
import { MetadataRepositoryImpl } from './MetadataRepositoryImpl'

const _apiMap = new Map<number, string>()
let _latestVersion: number = -Infinity
const describeMetadata = new Map<number, Metadata[]>()
const inFileMetadata = new Map<string, SharedFileMetadata>()
const sharedFolderMetadata = new Map<string, string>()

const buildAPIMap = async () => {
  if (_apiMap.size === 0) {
    const dir = await readdir(__dirname)
    dir
      .filter(file => /^[a-z]+\d+\.json$/.test(file))
      .forEach((file: string) => {
        const version: number = parseInt(file.match(/\d+/)?.[0] as string)
        _apiMap.set(version, file)
      })
    setLatestSupportedVersion()
  }
}

const setLatestSupportedVersion = () => {
  const versions: number[] = Array.from(_apiMap.keys())
  versions.sort((a, b) => a - b)
  _latestVersion = versions[versions.length - 2]
}

export const getLatestSupportedVersion = async () => {
  await buildAPIMap()
  return _latestVersion
}

export const isVersionSupported = async (version: number) => {
  await buildAPIMap()
  return _apiMap.has(version)
}

export const getDefinition = async (
  apiVersion: number
): Promise<MetadataRepository> => {
  await buildAPIMap()
  const version: number = _apiMap.has(apiVersion) ? apiVersion : _latestVersion
  if (!describeMetadata.has(version)) {
    const apiFile: string = _apiMap.get(version)!
    const fileContent: string = await readFile(
      resolve(__dirname, apiFile),
      'utf-8'
    )
    describeMetadata.set(version, JSON.parse(fileContent))
  }

  const metadataRepository: MetadataRepository = new MetadataRepositoryImpl(
    describeMetadata.get(version)!
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
            acc.set(val!.suffix!, val!.xmlName),
          sharedFolderMetadata
        )
