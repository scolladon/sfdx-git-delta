'use strict'
import { resolve } from 'path'
import { readdir } from 'fs/promises'

const _apiMap = new Map()
let _latestVersion: number = -Infinity
const describeMetadata = new Map()
const inFileMetadata = new Map()
const sharedFolderMetadata = new Map()

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

export const isVersionSupported = async version => {
  await buildAPIMap()
  return _apiMap.has(version)
}

export const getDefinition = async (grouping, apiVersion) => {
  if (!describeMetadata.has(apiVersion)) {
    await buildAPIMap()
    const apiFile = _apiMap.has(apiVersion)
      ? _apiMap.get(apiVersion)
      : _apiMap.get(_latestVersion)
    describeMetadata.set(apiVersion, require(resolve(__dirname, apiFile)))
  }

  return describeMetadata.get(apiVersion).reduce((metadata, describe) => {
    metadata.set(describe[grouping], describe)
    return metadata
  }, new Map())
}

export const isPackable = type =>
  !Array.from(inFileMetadata.values()).find(
    inFileDef => inFileDef.xmlName === type
  ).excluded

export const getInFileAttributes = (metadata: any) =>
  inFileMetadata.size
    ? inFileMetadata
    : Array.from(metadata.values())
        .filter((meta: any) => meta.xmlTag)
        .reduce(
          (acc: Map<string, any>, meta: any) =>
            acc.set(meta.xmlTag, {
              xmlName: meta.xmlName,
              key: meta.key,
              excluded: !!meta.excluded,
            }),
          inFileMetadata
        )

export const getSharedFolderMetadata = metadata =>
  sharedFolderMetadata.size
    ? sharedFolderMetadata
    : Array.from(metadata.values())
        .filter((meta: any) => meta.content)
        .flatMap((elem: any) => elem.content)
        .reduce(
          (acc, val) => acc.set(val.suffix, val.xmlName),
          sharedFolderMetadata
        )
