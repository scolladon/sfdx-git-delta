'use strict'
const StandardHandler = require('./standardHandler')
const {
  INFOLDER_SUFFIX,
  META_REGEX,
  METAFILE_SUFFIX,
} = require('../utils/metadataConstants')
const { join, normalize, parse, sep } = require('path')
const { readdir } = require('fs').promises

const INFOLDER_SUFFIX_REGEX = new RegExp(`${INFOLDER_SUFFIX}$`)
const EXTENSION_SUFFIX_REGEX = new RegExp(/\.[^/.]+$/)
class InFolderHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyFolderMetaFile()
    await this._copySpecialExtension()
  }

  async _copyFolderMetaFile() {
    const [, , folderPath, folderName] = this._parseLine()

    const folderFileName = `${folderName}.${
      StandardHandler.metadata.get(this.type).suffix.toLowerCase() +
      METAFILE_SUFFIX
    }`

    await this._copyWithMetaFile(
      normalize(join(this.config.repo, folderPath, folderFileName)),
      normalize(join(this.config.output, folderPath, folderFileName))
    )
  }

  async _copySpecialExtension() {
    const parsedLine = parse(this.line)
    const dirContent = await readdir(parsedLine.dir)

    await Promise.all(
      dirContent
        .filter(file => file.includes(parsedLine.name))
        .map(file =>
          this._copyWithMetaFile(
            normalize(join(this.config.repo, parsedLine.dir, file)),
            normalize(join(this.config.output, parsedLine.dir, file))
          )
        )
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
