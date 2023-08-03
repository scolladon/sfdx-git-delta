'use strict'
import StandardHandler from './standardHandler'
import {
  INFOLDER_SUFFIX,
  META_REGEX,
  METAFILE_SUFFIX,
} from '../utils/metadataConstants'
import { cleanUpPackageMember } from '../utils/packageHelper'
import { join, parse, sep } from 'path'
import { readDir } from '../utils/fsHelper'

const INFOLDER_SUFFIX_REGEX = new RegExp(`${INFOLDER_SUFFIX}$`)
const EXTENSION_SUFFIX_REGEX = new RegExp(/\.[^/.]+$/)
export default class InFolderHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyFolderMetaFile()
    await this._copySpecialExtension()
  }

  async _copyFolderMetaFile() {
    const [, folderPath, folderName] = this._parseLine()

    const folderFileName = `${folderName}.${
      this.metadata.get(this.type).suffix.toLowerCase() + METAFILE_SUFFIX
    }`

    await this._copyWithMetaFile(join(folderPath, folderFileName))
  }

  async _copySpecialExtension() {
    const parsedLine = parse(this.line)
    const dirContent = await readDir(parsedLine.dir, this.config)

    await Promise.all(
      dirContent
        .filter(file => file.includes(parsedLine.name))
        .map(file => this._copyWithMetaFile(join(parsedLine.dir, file)))
    )
  }

  _getElementName() {
    const packageMember = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .join(sep)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')

    return cleanUpPackageMember(packageMember)
  }

  _isProcessable() {
    return (
      super._isProcessable() ||
      this._parentFolderIsNotTheType() ||
      this.ext.endsWith(INFOLDER_SUFFIX)
    )
  }
}
