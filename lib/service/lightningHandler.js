'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')

class LightningHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const fileName = this.splittedLine.slice(0, -1).join(path.sep)

    fse.copySync(
      path.join(this.config.repo, fileName),
      path.join(this.config.output, fileName)
    )
  }

  handleModification() {
    this.handleAddition(this)
  }
}

module.exports = LightningHandler
