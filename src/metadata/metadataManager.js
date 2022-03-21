'use strict'
const { resolve } = require('path')
const { readdir } = require('fs').promises

const LATEST = 'latest'

let _apiMap
const describeMetadata = new Map()

const getApiMap = async () => {
  if (!_apiMap) {
    const dir = await readdir(__dirname)
    _apiMap = dir
      .filter(file => /^[a-z]+\d+\.json$/.test(file))
      .reduce((accu, file) => {
        const version = file.match(/\d+/)[0]
        accu.set(version, file)
        if (!accu.has(LATEST) || accu.get(LATEST) < version)
          accu.set(LATEST, version)
        return accu
      }, new Map())
    _apiMap.set(LATEST, _apiMap.get(_apiMap.get(LATEST)))
  }
  return _apiMap
}

module.exports = {
  getDefinition: async (grouping, apiVersion) => {
    if (!describeMetadata.has(apiVersion)) {
      const apiMap = await getApiMap()
      const apiFile = apiMap.has(apiVersion)
        ? apiMap.get(apiVersion)
        : apiMap.get(LATEST)
      describeMetadata.set(apiVersion, require(resolve(__dirname, apiFile)))
    }

    return describeMetadata.get(apiVersion).reduce((metadata, describe) => {
      metadata.set(describe[grouping], describe)
      return metadata
    }, new Map())
  },
}
