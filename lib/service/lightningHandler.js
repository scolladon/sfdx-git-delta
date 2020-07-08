'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')

class LightningHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const fileName = this.splittedLine.slice(0, -1).join(path.sep)

    this._copyFiles(
      path.join(this.config.repo, fileName),
      path.join(this.config.output, fileName)
    )
  }
}

module.exports = LightningHandler
