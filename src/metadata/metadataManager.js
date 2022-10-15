'use strict'
const { resolve } = require('path')
const { readdir } = require('fs').promises

const _apiMap = new Map()
let _latestVersion = null
const describeMetadata = new Map()

const buildAPIMap = async () => {
  if (_apiMap.size === 0) {
    const dir = await readdir(__dirname)
    dir
      .filter(file => /^[a-z]+\d+\.json$/.test(file))
      .forEach(file => {
        const version = parseInt(file.match(/\d+/)[0])
        _apiMap.set(version, file)
        _latestVersion = Math.max(_latestVersion, version)
      })
  }
}

const getLatestSupportedVersion = async () => {
  await buildAPIMap()
  return _latestVersion
}

const isVersionSupported = async version => {
  await buildAPIMap()
  return _apiMap.has(version)
}

const getDefinition = async (grouping, apiVersion) => {
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

module.exports.getDefinition = getDefinition
module.exports.getLatestSupportedVersion = getLatestSupportedVersion
module.exports.isVersionSupported = isVersionSupported
