'use strict'
const fs = require('fs')
const path = require('path')
const fse = require('fs-extra')
const gc = require('../utils/gitConstants')
const mc = require('../utils/metadataConstants')

const PACKAGE_MEMBER_PATH_SEP = '/'

const FSE_COPYSYNC_OPTION = {
  overwrite: true,
  errorOnExist: false,
  dereference: true,
  preserveTimestamps: false,
}

const copiedFiles = new Set()

class StandardHandler {
  static metadata

  constructor(line, type, work, metadata) {
    StandardHandler.metadata = StandardHandler.metadata ?? metadata
    ;[this.changeType] = line
    this.line = line.replace(gc.GIT_DIFF_TYPE_REGEX, '')
    this.type = type
    this.diffs = work.diffs
    this.config = work.config
    this.splittedLine = this.line.split(path.sep)
    this.warnings = work.warnings

    if (StandardHandler.metadata[this.type].metaFile === true) {
      this.line = this.line.replace(mc.METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(
      `\\.${StandardHandler.metadata[this.type].suffix}$`
    )

    this.handlerMap = {
      A: this.handleAddition,
      D: this.handleDeletion,
      M: this.handleModification,
    }
  }

  handle() {
    if (this.handlerMap[this.changeType]) {
      try {
        this.handlerMap[this.changeType].apply(this)
      } catch (error) {
        error.message = `${this.line}: ${error.message}`
        this.warnings.push(error)
      }
    }
  }

  handleAddition() {
    this._fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    const source = path.join(this.config.repo, this.line)
    const target = path.join(this.config.output, this.line)

    this._copyFiles(source, target)
    if (StandardHandler.metadata[this.type].metaFile === true) {
      this._copyFiles(source + mc.METAFILE_SUFFIX, target + mc.METAFILE_SUFFIX)
    }
  }

  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleModification() {
    this.handleAddition()
  }

  _getParsedPath() {
    return path.parse(
      this.splittedLine
        .slice(
          this.splittedLine.findIndex(x => x.includes(mc.METAFILE_SUFFIX)) - 1
        )
        .join(path.sep)

        .replace(mc.META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return StandardHandler.cleanUpPackageMember(parsedPath.base)
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] ?? new Set()
    packageObject[this.type].add(this._getElementName())
  }

  _copyFiles(src, dst) {
    if (!copiedFiles.has(src) && fse.pathExistsSync(src)) {
      fse.copySync(src, dst, FSE_COPYSYNC_OPTION)
      copiedFiles.add(src)
    }
  }

  _readFileSync() {
    return fs.readFileSync(path.join(this.config.repo, this.line), {
      encoding: gc.UTF8_ENCODING,
    })
  }

  static cleanUpPackageMember(packageMember) {
    return `${packageMember}`.replace(/\\+/g, PACKAGE_MEMBER_PATH_SEP)
  }

  static PACKAGE_MEMBER_PATH_SEP = PACKAGE_MEMBER_PATH_SEP
}

module.exports = StandardHandler
