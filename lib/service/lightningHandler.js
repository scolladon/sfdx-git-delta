'use strict'
const metadata = require('../metadata/metadata')('directoryName')
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
    if (metadata[this.type].metaFile === true) {
      this.line = this.line.replace(StandardHandler.METAFILE_SUFFIX, '')
    }

    this.promises.push(
      fse.copy(
        path.join(
          this.config.repo,

          this.splittedLine.slice(0, -1).join(path.sep)
        ),
        path.join(
          this.config.output,

          this.splittedLine.slice(0, -1).join(path.sep)
        )
      )
    )
  }

  handleModification() {
    this.handleAddtion.apply(this)
  }
}

module.exports = LightningHandler
