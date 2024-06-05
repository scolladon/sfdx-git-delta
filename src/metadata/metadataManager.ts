'use strict'
import { resolve } from 'path'

import { readFile, readdir } from 'fs-extra'

import type { Metadata } from '../types/metadata'

import { MetadataRepository } from './MetadataRepository'
import { MetadataRepositoryImpl } from './MetadataRepositoryImpl'

const _apiMap = new Map<number, string>()
let _latestVersion: number = -Infinity
const describeMetadata = new Map<number, Metadata[]>()

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

  const metadataRepository: MetadataRepository =
    MetadataRepositoryImpl.getInstance(describeMetadata.get(version)!)
  return metadataRepository
}
