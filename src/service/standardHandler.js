'use strict'
const { join, parse, sep } = require('path')
const {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} = require('../utils/gitConstants')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')
const { fillPackageWithParameter } = require('../utils/packageHelper')
const { copyFiles } = require('../utils/fsHelper')

const PACKAGE_MEMBER_PATH_SEP = '/'

const RegExpEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

class StandardHandler {
  static metadata

  constructor(line, type, work, metadata) {
    StandardHandler.metadata = StandardHandler.metadata ?? metadata
    ;[this.changeType] = line
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    this.type = type
    this.work = work
    // internal getters
    this.diffs = work.diffs
    this.config = work.config
    this.warnings = work.warnings
    this.splittedLine = this.line.split(sep)

    if (StandardHandler.metadata.get(this.type).metaFile === true) {
      this.line = this.line.replace(METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(
      `\\.${StandardHandler.metadata.get(this.type).suffix}$`
    )

    this.handlerMap = {
      [ADDITION]: this.handleAddition,
      [DELETION]: this.handleDeletion,
      [MODIFICATION]: this.handleModification,
    }

    this.ext = parse(this.line).ext.substring(1)
  }

  async handle() {
    if (this.handlerMap[this.changeType]) {
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
    return StandardHandler.cleanUpPackageMember(parsedPath.base)
  }

  _fillPackage(packageObject) {
    fillPackageWithParameter({
      package: packageObject,
      type: this.type,
      elementName: this._getElementName(),
    })
  }

  async _copyWithMetaFile(src) {
    await copyFiles(this.config, src)
    if (
      StandardHandler.metadata.get(this.type).metaFile === true &&
      !`${src}`.endsWith(METAFILE_SUFFIX)
    ) {
      await copyFiles(this.config, this._getMetaTypeFilePath(src))
    }
  }

  _getMetaTypeFilePath(path) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${this.ext}${METAFILE_SUFFIX}`
    )
  }

  _parseLine() {
    const regexRepo = this.config.repo !== '.' ? this.config.repo : ''
    return join(this.config.repo, this.line).match(
      new RegExp(
        `(?<repo>${RegExpEscape(regexRepo)})(?<path>.*[/\\\\]${RegExpEscape(
          StandardHandler.metadata.get(this.type).directoryName
        )})[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
  }

  static cleanUpPackageMember(packageMember) {
    return `${packageMember}`.replace(/\\+/g, PACKAGE_MEMBER_PATH_SEP)
  }

  static PACKAGE_MEMBER_PATH_SEP = PACKAGE_MEMBER_PATH_SEP
}

module.exports = StandardHandler
