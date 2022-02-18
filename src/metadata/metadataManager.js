'use strict'
const { resolve } = require('path')
const { readdir } = require('fs').promises

let _apiMap
const describeMetadata = {}

const getApiMap = async () => {
  if (!_apiMap) {
    const dir = await readdir(__dirname)
    _apiMap = dir
      .filter(file => /^[a-z]+\d+\.json$/.test(file))
      .reduce((accu, file) => {
        const version = file.match(/\d+/)[0]
        accu[version] = file
        accu.latest =
          !accu.latest || accu.latest < version ? version : accu.latest
        return accu
      }, {})
    _apiMap.latest = _apiMap[_apiMap.latest]
  }
  return _apiMap
}

module.exports = {
  getDefinition: async (grouping, apiVersion) => {
    if (!describeMetadata[apiVersion]) {
      const apiMap = await getApiMap()
      const apiFile =
        !!apiVersion && Object.prototype.hasOwnProperty.call(apiMap, apiVersion)
          ? apiMap[apiVersion]
          : apiMap.latest
      describeMetadata[apiVersion] = require(resolve(__dirname, apiFile))
    }

    return describeMetadata[apiVersion].reduce((metadata, describe) => {
      metadata[describe[grouping]] = describe
      return metadata
    }, {})
  },
}
