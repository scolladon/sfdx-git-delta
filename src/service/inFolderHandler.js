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
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyFolderMetaFile()
  }

  async _copyFolderMetaFile() {
    const [, , folderPath, folderName] = this._parseLine()

    const folderFileName = `${folderName}.${
      StandardHandler.metadata.get(this.type).suffix.toLowerCase() +
      INFOLDER_SUFFIX +
      METAFILE_SUFFIX
    }`

    await this._copyFiles(
      normalize(join(this.config.repo, folderPath, folderFileName)),
      normalize(join(this.config.output, folderPath, folderFileName))
    )
  }

  _fillPackage(packageObject) {
    if (!packageObject.has(this.type)) {
      packageObject.set(this.type, new Set())
    }

    const packageMember = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .join(sep)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')

    packageObject
      .get(this.type)
      .add(StandardHandler.cleanUpPackageMember(packageMember))
  }
}

module.exports = InFolderHandler
