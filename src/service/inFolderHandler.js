'use strict'
const StandardHandler = require('./standardHandler')
const {
  INFOLDER_SUFFIX,
  META_REGEX,
  METAFILE_SUFFIX,
} = require('../utils/metadataConstants')
const { join, normalize, sep } = require('path')

const INFOLDER_SUFFIX_REGEX = new RegExp(`${INFOLDER_SUFFIX}$`)
const EXTENSION_SUFFIX_REGEX = new RegExp(/\.[^/.]+$/)
class InFolderHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const regexRepo = this.config.repo !== '.' ? this.config.repo : ''

    let [, , folderPath, folderName] = join(this.config.repo, this.line).match(
      new RegExp(
        `(${RegExpEscape(regexRepo)})(?<path>.*[/\\\\]${RegExpEscape(
          StandardHandler.metadata[this.type].directoryName
        )})[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
    folderName = `${folderName}.${
      StandardHandler.metadata[this.type].xmlName.toLowerCase() +
      INFOLDER_SUFFIX +
      METAFILE_SUFFIX
    }`

    this._copyFiles(
      normalize(join(this.config.repo, folderPath, folderName)),
      normalize(join(this.config.output, folderPath, folderName))
    )
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] ?? new Set()

    const packageMember = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .join(sep)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')

    packageObject[this.type].add(
      StandardHandler.cleanUpPackageMember(packageMember)
    )
  }
}

module.exports = InFolderHandler

const RegExpEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
