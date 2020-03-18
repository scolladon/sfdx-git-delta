'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')

class LightningHandler extends StandardHandler {
  handleAddition() {
    const fileName = this.splittedLine.slice(0, -1).join(path.sep)
    this.promises.push(
      fse.copy(
        path.join(this.config.repo, fileName),
        path.join(this.config.output, fileName)
      )
    )
  }

  handleModification() {
    this.handleAddition(this)
  }
}

module.exports = LightningHandler
