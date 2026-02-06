'use strict'
import { join, parse } from 'node:path/posix'

import { EXTENSION_SUFFIX_REGEX, PATH_SEP } from '../constant/fsConstants.js'
import {
  INFOLDER_SUFFIX,
  META_REGEX,
  METAFILE_SUFFIX,
} from '../constant/metadataConstants.js'
import { readDirs } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

const INFOLDER_SUFFIX_REGEX = new RegExp(`${INFOLDER_SUFFIX}$`)
export default class InFolderHandler extends StandardHandler {
  @log
  public override async handleAddition() {
    await this._resolveMetadata()
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyFolderMetaFile()
    await this._copySpecialExtension()
  }

  protected async _copyFolderMetaFile() {
    const [, folderPath, folderName] = this._parseLine()!

    const suffix = folderName.endsWith(INFOLDER_SUFFIX)
      ? ''
      : `.${this.metadataDef.suffix!.toLowerCase()}`

    const folderFileName = `${folderName}${suffix}${METAFILE_SUFFIX}`

    await this._copyWithMetaFile(join(folderPath, folderFileName))
  }

  protected async _copySpecialExtension() {
    const parsedLine = parse(this.line)
    const dirContent = await readDirs(parsedLine.dir, this.config)

    await Promise.all(
      dirContent
        .filter((file: string) => file.includes(parsedLine.name))
        .map((file: string) => this._copyWithMetaFile(file))
    )
  }

  protected override _getElementName() {
    const startIndex = this._getDirectoryStartIndex()
    return this.splittedLine
      .slice(startIndex)
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')
  }

  protected _getDirectoryStartIndex(): number {
    // Use resolver if available - find where content starts after directoryName
    if (this.resolvedMetadata) {
      const dirIndex = this.splittedLine.indexOf(this.metadataDef.directoryName)
      if (dirIndex >= 0) {
        return dirIndex + 1
      }
      // Fallback: content starts at boundaryIndex
      return this.resolvedMetadata.boundaryIndex
    }
    return this.splittedLine.indexOf(this.metadataDef.directoryName) + 1
  }

  protected override _isProcessable() {
    return (
      super._isProcessable() ||
      this._parentFolderIsNotTheType() ||
      this.ext!.endsWith(INFOLDER_SUFFIX)
    )
  }
}
