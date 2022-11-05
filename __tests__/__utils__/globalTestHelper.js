'use strict'
const {
  getDefinition,
  getLatestSupportedVersion,
} = require('../../src/metadata/metadataManager')

const getMetadata = async () => {
  const apiVersion = await getLatestSupportedVersion()
  const metadata = await getDefinition('directoryName', apiVersion)
  return metadata
}

global.getGlobalMetadata = getMetadata
