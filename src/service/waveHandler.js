'use strict'
const StandardHandler = require('./standardHandler')
const { fillPackageWithParameter } = require('../utils/packageHelper')

const WAVE_SUBTYPE = new Map()

class WaveHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)

    this.metadata
      .get(this.type)
      .content.reduce(
        (acc, val) => acc.set(val.suffix, val.xmlName),
        WAVE_SUBTYPE
      )
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
  }

  _fillPackage(store) {
    const type = WAVE_SUBTYPE.get(this.ext)
    fillPackageWithParameter({
      store,
      type: type,
      member: this._getElementName(),
    })
  }
}

module.exports = WaveHandler
