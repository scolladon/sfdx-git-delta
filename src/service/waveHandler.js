'use strict'
const StandardHandler = require('./standardHandler')
const { fillPackageWithParameter } = require('../utils/packageHelper')
const { getWaveMetadata } = require('../metadata/metadataManager')

class WaveHandler extends StandardHandler {
  waveMetadata

  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
    this.waveMetadata = getWaveMetadata(this.metadata)
  }

  _fillPackage(store) {
    const type = this.waveMetadata.get(this.ext)
    fillPackageWithParameter({
      store,
      type: type,
      member: this._getElementName(),
    })
  }

  _isProcessable() {
    return super._isProcessable() || this.waveMetadata.has(this.ext)
  }
}

module.exports = WaveHandler
