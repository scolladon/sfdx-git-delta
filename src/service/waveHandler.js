'use strict'
const StandardHandler = require('./standardHandler')
const { fillPackageWithParameter } = require('../utils/packageHelper')
const { getWaveMetadata } = require('../metadata/metadataManager')

class WaveHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
  }

  _fillPackage(store) {
    const waveMetadata = getWaveMetadata(this.metadata)
    const type = waveMetadata.get(this.ext)
    fillPackageWithParameter({
      store,
      type: type,
      member: this._getElementName(),
    })
  }
}

module.exports = WaveHandler
