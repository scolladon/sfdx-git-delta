const { META_REGEX } = require('./metadataConstants')
const { parse } = require('path')

module.exports.getMetadataName = metadataPath =>
  parse(metadataPath.replace(META_REGEX, '')).name
