'use strict'
const metadataManager = require('../metadata/metadataManager')
const path = require('path')
const fse = require('fs-extra')

class StandardHandler {
  constructor(line, type, work) {
    ;[this.changeType] = line
    this.line = line.replace(/^.\s*/u, '')
    this.type = type
    this.diffs = work.diffs
    this.promises = work.promises
    this.config = work.config
    this.splittedLine = this.line.split(path.sep)
    this.metadata = metadataManager.getDefinition(
      'directoryName',
      this.config.apiVersion
    )

    if (this.metadata[this.type].metaFile === true) {
      this.line = this.line.replace(StandardHandler.METAFILE_SUFFIX, '')
    }

    this.handlerMap = {
      A: this.handleAddtion,
      D: this.handleDeletion,
      M: this.handleModification,
    }
  }

  handle() {
    if (this.handlerMap[this.changeType]) {
      this.handlerMap[this.changeType].apply(this)
    }
  }

  handleAddtion() {
    const source = path.join(this.config.repo, this.line)
    const target = path.join(this.config.output, this.line)

    this.promises.push(fse.copy(source, target))
    if (this.metadata[this.type].metaFile === true) {
      this.promises.push(
        fse.copy(
          source + StandardHandler.METAFILE_SUFFIX,
          target + StandardHandler.METAFILE_SUFFIX
        )
      )
    }
  }

  handleDeletion() {
    if (
      (this.metadata[this.type].metaFile === true &&
        !this.line.endsWith(StandardHandler.METAFILE_SUFFIX)) ||
      this.metadata[this.type].metaFile === false
    ) {
      this.diffs[this.type] = this.diffs[this.type] || new Set()

      this.diffs[this.type].add(this._getElementName())
    }
  }

  handleModification() {
    this.handleAddtion.apply(this)
  }

  _getElementName() {
    return this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
      .replace(StandardHandler.METAFILE_SUFFIX, '')
      .replace(`.${this.metadata[this.type].suffix}`, '')
  }
}

StandardHandler.METAFILE_SUFFIX = '-meta.xml'
module.exports = StandardHandler
