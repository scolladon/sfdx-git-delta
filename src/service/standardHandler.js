'use strict'
const { copyFile, readFile } = require('fs').promises
const { join, parse, sep } = require('path')
const { copy, copySync, pathExists } = require('fs-extra')
const {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
  UTF8_ENCODING,
} = require('../utils/gitConstants')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')

const PACKAGE_MEMBER_PATH_SEP = '/'

const FSE_BIGINT_ERROR = 'Source and destination must not be the same.'

const FSE_COPYSYNC_OPTION = {
  overwrite: true,
  errorOnExist: false,
  dereference: true,
  preserveTimestamps: false,
}

const copiedFiles = new Set()

const RegExpEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

class StandardHandler {
  static metadata

  constructor(line, type, work, metadata) {
    StandardHandler.metadata = StandardHandler.metadata ?? metadata
    ;[this.changeType] = line
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    this.type = type
    this.diffs = work.diffs
    this.config = work.config
    this.splittedLine = this.line.split(sep)
    this.warnings = work.warnings

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

    const source = join(this.config.repo, this.line)
    const target = join(this.config.output, this.line)

    await this._copyWithMetaFile(source, target)
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
    this._fillPackageWithParameter({
      package: packageObject,
      type: this.type,
      elementName: this._getElementName(),
    })
  }

  _fillPackageWithParameter(params) {
    if (!params.package.has(params.type)) {
      params.package.set(params.type, new Set())
    }
    params.package.get(params.type).add(params.elementName)
  }

  async _copyWithMetaFile(src, dst) {
    const file = this._copyFiles(src, dst)
    if (StandardHandler.metadata.get(this.type).metaFile === true) {
      await this._copyFiles(
        this._getMetaTypeFilePath(src),
        this._getMetaTypeFilePath(dst)
      )
    }
    await file
  }

  _getMetaTypeFilePath(path) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${this.ext}${METAFILE_SUFFIX}`
    )
  }

  async _copyFiles(src, dst) {
    if (copiedFiles.has(src)) return
    const exists = await pathExists(src)
    if (!copiedFiles.has(src) && exists) {
      copiedFiles.add(src)
      try {
        await copy(src, dst, FSE_COPYSYNC_OPTION)
      } catch (error) {
        if (error.message === FSE_BIGINT_ERROR) {
          // Handle this fse issue manually (https://github.com/jprichardson/node-fs-extra/issues/657)
          await copyFile(src, dst)
        } else {
          // Retry sync in case of async error
          copySync(src, dst, FSE_COPYSYNC_OPTION)
        }
      }
    }
  }

  async _readFile() {
    const file = await readFile(this.line, {
      encoding: UTF8_ENCODING,
    })
    return file
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
module.exports.FSE_BIGINT_ERROR = FSE_BIGINT_ERROR
