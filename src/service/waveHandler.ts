'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')

const WAVE_SUBTYPE = {}

const isEmpty = obj => {
  for (let i in obj) return false
  return true
}

class WaveHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    if (isEmpty(WAVE_SUBTYPE)) {
      StandardHandler.metadata[this.type].content.reduce((acc, val) => {
        acc[val.suffix] = val.xmlName
        return acc
      }, WAVE_SUBTYPE)
    }
    this.ext = path.parse(this.line).ext.substring(1)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
  }

  _fillPackage(packageObject) {
    const type = WAVE_SUBTYPE[this.ext]
    packageObject[type] = packageObject[type] ?? new Set()
    packageObject[type].add(this._getElementName())
  }
}

module.exports = WaveHandler
