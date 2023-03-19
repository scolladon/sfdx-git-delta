'use strict'
const StandardHandler = require('./standardHandler')
const { fillPackageWithParameter } = require('../utils/packageHelper')

let WAVE_SUBTYPE

class WaveHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    WAVE_SUBTYPE =
      WAVE_SUBTYPE ??
      [...metadata.values()]
        .filter(meta => meta.content)
        .flatMap(elem => elem.content)
        .reduce((acc, val) => acc.set(val.suffix, val.xmlName), new Map())
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
