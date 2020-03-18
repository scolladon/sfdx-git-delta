'use strict'
const path = require('path')
const fse = require('fs-extra')

class StandardHandler {
  constructor(line, type, work, metadata) {
    ;[this.changeType] = line
    this.line = line.replace(/^.\s*/u, '')
    this.type = type
    this.diffs = work.diffs
    this.promises = work.promises
    this.config = work.config
    this.splittedLine = this.line.split(path.sep)
    this.metadata = metadata

    if (this.metadata[this.type].metaFile === true) {
      this.line = this.line.replace(StandardHandler.METAFILE_SUFFIX, '')
    }

    this.handlerMap = {
      A: this.handleAddition,
      D: this.handleDeletion,
      M: this.handleModification,
    }
  }

  handle() {
    if (this.handlerMap[this.changeType]) {
      this.handlerMap[this.changeType].apply(this)
    }
  }

  handleAddition() {
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
    this._fillPackage(this.diffs.package)
  }

  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleModification() {
    this.handleAddition(this)
  }

  _getElementName() {
    const parsedPath = path.parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(StandardHandler.METAFILE_SUFFIX, '')
        .replace(`.${this.metadata[this.type].suffix}`, '')
    )

    return parsedPath.dir + parsedPath.name
  }

  _fillPackage(packageObject) {
    if (
      (this.metadata[this.type].metaFile === true &&
        !this.line.endsWith(StandardHandler.METAFILE_SUFFIX)) ||
      this.metadata[this.type].metaFile === false
    ) {
      packageObject[this.type] = packageObject[this.type] || new Set()
      packageObject[this.type].add(this._getElementName())
    }
  }
}

StandardHandler.METAFILE_SUFFIX = '-meta.xml'
module.exports = StandardHandler
