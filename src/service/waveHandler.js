'use strict'
const StandardHandler = require('./standardHandler')

const WAVE_SUBTYPE = new Map()

class WaveHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)

    StandardHandler.metadata
      .get(this.type)
      .content.reduce(
        (acc, val) => acc.set(val.suffix, val.xmlName),
        WAVE_SUBTYPE
      )
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
  }

  _fillPackage(packageObject) {
    const type = WAVE_SUBTYPE.get(this.ext)
    if (!packageObject.has(type)) {
      packageObject.set(type, new Set())
    }
    packageObject.get(type).add(this._getElementName())
  }
}

module.exports = WaveHandler
