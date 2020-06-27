'use strict'
const path = require('path')
const fse = require('fs-extra')
const mc = require('../utils/metadataConstants')

const FSE_COPYSYNC_OPTION = {
  overwrite: true,
  errorOnExist: false,
  dereference: true,
  preserveTimestamps: false,
}

class StandardHandler {
  constructor(line, type, work, metadata) {
    ;[this.changeType] = line
    this.line = line.replace(/^.\s*/u, '')
    this.type = type
    this.diffs = work.diffs
    this.config = work.config
    this.splittedLine = this.line.split(path.sep)
    this.metadata = metadata

    if (this.metadata[this.type].metaFile === true) {
      this.line = this.line.replace(mc.METAFILE_SUFFIX, '')
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
    this._fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    const source = path.join(this.config.repo, this.line)
    const target = path.join(this.config.output, this.line)

    this._copyFiles(source, target)
    if (this.metadata[this.type].metaFile === true) {
      this._copyFiles(source + mc.METAFILE_SUFFIX, target + mc.METAFILE_SUFFIX)
    }
  }

  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleModification() {
    this.handleAddition(this)
  }

  _getParsedPath() {
    const parsedPath = path.parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(mc.METAFILE_SUFFIX, '')
        .replace(`.${this.metadata[this.type].suffix}`, '')
    )
    return parsedPath
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return parsedPath.dir + parsedPath.base
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] || new Set()
    packageObject[this.type].add(this._getElementName())
  }

  _copyFiles(src, dst) {
    if (fse.pathExistsSync(src)) {
      fse.copySync(src, dst, FSE_COPYSYNC_OPTION)
    }
  }
}

module.exports = StandardHandler
