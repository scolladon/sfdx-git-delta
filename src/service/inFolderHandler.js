'use strict'
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')

const INFOLDER_SUFFIX_REGEX = new RegExp(`${mc.INFOLDER_SUFFIX}$`)
const EXTENSION_SUFFIX_REGEX = new RegExp(/\.[^/.]+$/)
class InFolderHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const regexRepo = this.config.repo !== '.' ? this.config.repo : ''

    let [, , folderPath, folderName] = path
      .join(this.config.repo, this.line)
      .match(
        new RegExp(
          `(${RegExpEscape(regexRepo)})(?<path>.*[/\\\\]${RegExpEscape(
            StandardHandler.metadata[this.type].directoryName
          )})[/\\\\](?<name>[^/\\\\]*)+`,
          'u'
        )
      )
    folderName = `${folderName}.${
      StandardHandler.metadata[this.type].xmlName.toLowerCase() +
      mc.INFOLDER_SUFFIX +
      mc.METAFILE_SUFFIX
    }`

    this._copyFiles(
      path.normalize(path.join(this.config.repo, folderPath, folderName)),
      path.normalize(path.join(this.config.output, folderPath, folderName))
    )
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] ?? new Set()

    const packageMember = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .join(path.sep)
      .replace(mc.META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')

    packageObject[this.type].add(
      StandardHandler.cleanUpPackageMember(packageMember)
    )
  }
}

module.exports = InFolderHandler

const RegExpEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
