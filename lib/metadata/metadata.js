'use strict'
const describeMetadata = require('./v46.json')
module.exports = grouping =>
  describeMetadata.reduce((metadata, describe) => {
    metadata[describe[grouping]] = describe
    return metadata
  }, {})
