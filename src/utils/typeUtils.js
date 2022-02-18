'use strict'
const CustomObject = require('../service/customObjectHandler')
const path = require('path')

const haveSubTypes = [CustomObject.OBJECT_TYPE, '']

module.exports.getType = (line, metadata) =>
  line.split(path.sep).reduce((acc, value, _, arr) => {
    acc = Object.prototype.hasOwnProperty.call(metadata, value) ? value : acc
    if (!haveSubTypes.includes(acc)) arr.splice(1)
    return acc
  }, '')
