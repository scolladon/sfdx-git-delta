'use strict'
const path = require('path')
const fs = require('fs')

let _apiMap
const describeMetadata = {}

const getApiMap = () => {
  if (!_apiMap) {
    _apiMap = fs
      .readdirSync(__dirname)
      .filter(file => /^v\d+\.json$/.test(file))
      .reduce((accu, file) => {
        const version = file.match(/\d+/)[0]
        accu[version] = file
        if (!accu.latest || accu.latest < version) {
          accu.latest = version
        }
        return accu
      }, {})
    _apiMap.latest = _apiMap[_apiMap.latest]
  }
  return _apiMap
}

module.exports = {
  getDefinition: (grouping, apiVersion) => {
    if (!describeMetadata[apiVersion]) {
      const apiMap = getApiMap()
      const apiFile =
        !!apiVersion && Object.prototype.hasOwnProperty.call(apiMap, apiVersion)
          ? apiMap[apiVersion]
          : apiMap.latest
      describeMetadata[apiVersion] = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, apiFile))
      )
    }

    return describeMetadata[apiVersion].reduce((metadata, describe) => {
      metadata[describe[grouping]] = describe
      return metadata
    }, {})
  },
}
