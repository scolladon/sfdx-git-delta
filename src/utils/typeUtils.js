'use strict'
const CustomObject = require('../service/customObjectHandler')
const { sep } = require('path')

const haveSubTypes = [
  CustomObject.OBJECT_TYPE,
  CustomObject.TERRITORY_MODEL_TYPE,
  '',
]

module.exports.getType = (line, metadata) =>
  line.split(sep).reduce((acc, value, _, arr) => {
    acc = metadata.has(value) ? value : acc
    if (!haveSubTypes.includes(acc)) arr.splice(1)
    return acc
  }, '')
