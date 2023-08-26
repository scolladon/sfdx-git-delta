'use strict'
import { resolve } from 'path'
import { readFile, readdir } from 'fs-extra'
import {
  BaseMetadata,
  Metadata,
  MetadataRepository,
  SharedFileMetadata,
  SharedFolderMetadata,
} from '../types/metadata'

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
        _latestVersion = Math.max(_latestVersion, version)
      })
  }
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
  if (!describeMetadata.has(apiVersion)) {
    await buildAPIMap()
    const apiFile = (
      _apiMap.has(apiVersion)
        ? _apiMap.get(apiVersion)
        : _apiMap.get(_latestVersion)
    ) as string
    const fileContent: string = await readFile(
      resolve(__dirname, apiFile),
      'utf-8'
    )
    describeMetadata.set(apiVersion, JSON.parse(fileContent))
  }

  const metadataRepository: MetadataRepository = new Map<string, Metadata>()
  describeMetadata
    .get(apiVersion)
    ?.reduce((metadata: MetadataRepository, describe: Metadata) => {
      metadata.set(describe.directoryName, describe)
      return metadata
    }, metadataRepository)
  return metadataRepository
}

export const isPackable = (type: string) =>
  Array.from(inFileMetadata.values()).find(
    (inFileDef: SharedFileMetadata) => inFileDef.xmlName === type
  )?.excluded !== true

export const getInFileAttributes = (metadata: MetadataRepository) =>
  inFileMetadata.size
    ? inFileMetadata
    : Array.from(metadata.values())
        .filter((meta: Metadata) => meta.xmlTag)
        .reduce(
          (acc: Map<string, SharedFileMetadata>, meta: Metadata) =>
            acc.set(meta.xmlTag!, {
              xmlName: meta.xmlName,
              key: meta.key,
              excluded: !!meta.excluded,
            }),
          inFileMetadata
        )

export const getSharedFolderMetadata = (metadata: MetadataRepository) =>
  sharedFolderMetadata.size
    ? sharedFolderMetadata
    : Array.from(metadata.values())
        .filter((meta: Metadata) => meta.content)
        .flatMap((elem: SharedFolderMetadata) => elem.content)
        .reduce(
          (acc: Map<string, string>, val: BaseMetadata) =>
            acc.set(val.suffix!, val.xmlName),
          sharedFolderMetadata
        )
