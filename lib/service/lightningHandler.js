'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')

class LightningHandler extends StandardHandler {
  handle() {
    if (this.handlerMap[this.changeType]) {
      this.handlerMap[this.changeType].apply(this)
    }
  }

  handleAddtion() {
    const fileName = this.splittedLine.slice(0, -1).join(path.sep)
    this.promises.push(
      fse.copy(
        path.join(this.config.repo, fileName),
        path.join(this.config.output, fileName)
      )
    )
  }

  handleModification() {
    this.handleAddtion.apply(this)
  }
}

module.exports = LightningHandler
