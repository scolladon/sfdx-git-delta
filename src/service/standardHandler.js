'use strict'
const { join, parse, sep } = require('path')
const {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} = require('../utils/gitConstants')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')
const {
  cleanUpPackageMember,
  fillPackageWithParameter,
} = require('../utils/packageHelper')
const { copyFiles, DOT } = require('../utils/fsHelper')

const RegExpEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

class StandardHandler {
  constructor(line, type, work, metadata) {
    this.metadata = metadata
    ;[this.changeType] = line
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    this.type = type
    this.work = work
    // internal getters
    this.diffs = work.diffs
    this.config = work.config
    this.warnings = work.warnings
    this.splittedLine = this.line.split(sep)

    if (this.metadata.get(this.type)?.metaFile === true) {
      this.line = this.line.replace(METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(`\\.${this.metadata.get(this.type)?.suffix}$`)

    this.handlerMap = {
      [ADDITION]: this.handleAddition,
      [DELETION]: this.handleDeletion,
      [MODIFICATION]: this.handleModification,
    }
    this.parsedLine = parse(this.line)
    this.ext = this.parsedLine.base
      .replace(METAFILE_SUFFIX, '')
      .split(DOT)
      .pop()

    this.parentFolder = this.parsedLine.dir.split(sep).slice(-1)[0]
  }

  async handle() {
    if (this.handlerMap[this.changeType] && this._isProcessable()) {
      try {
        await this.handlerMap[this.changeType].apply(this)
      } catch (error) {
        error.message = `${this.line}: ${error.message}`
        this.warnings.push(error)
      }
    }
  }

  async handleAddition() {
    this._fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    await this._copyWithMetaFile(this.line)
  }

  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  async handleModification() {
    await this.handleAddition()
  }

  _getParsedPath() {
    return parse(
      this.splittedLine
        .slice(
          this.splittedLine.findIndex(x => x.includes(METAFILE_SUFFIX)) - 1
        )
        .join(sep)

        .replace(META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return cleanUpPackageMember(parsedPath.base)
  }

  _fillPackage(store) {
    fillPackageWithParameter({
      store,
      type: this.metadata.get(this.type).xmlName,
      member: this._getElementName(),
    })
  }

  async _copyWithMetaFile(src) {
    if (this._delegateFileCopy()) {
      await this._copy(src)
      if (
        this.metadata.get(this.type).metaFile === true &&
        !`${src}`.endsWith(METAFILE_SUFFIX)
      ) {
        await this._copy(this._getMetaTypeFilePath(src))
      }
    }
  }

  async _copy(elementPath) {
    if (this._delegateFileCopy()) {
      await copyFiles(this.config, elementPath)
    }
  }

  _getMetaTypeFilePath(path) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${
        this.metadata.get(this.type).suffix
      }${METAFILE_SUFFIX}`
    )
  }

  _parseLine() {
    return this.line.match(
      new RegExp(
        `(?<path>.*[/\\\\]${RegExpEscape(
          this.metadata.get(this.type).directoryName
        )})[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
  }

  _isProcessable() {
    return this.metadata.get(this.type).suffix === this.ext
  }

  _delegateFileCopy() {
    return true
  }

  _parentFolderIsNotTheType() {
    return this.parentFolder !== this.type
  }
}

module.exports = StandardHandler
