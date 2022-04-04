'use strict'
const {
  OBJECT_TYPE,
  TERRITORY_MODEL_TYPE,
} = require('../utils/metadataConstants')
const { sep } = require('path')

const haveSubTypes = [OBJECT_TYPE, TERRITORY_MODEL_TYPE, '']

module.exports.getType = (line, metadata) =>
  line.split(sep).reduce((acc, value, _, arr) => {
    acc = metadata.has(value) ? value : acc
    if (!haveSubTypes.includes(acc)) arr.splice(1)
    return acc
  }, '')
