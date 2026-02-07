'use strict'
import { join, parse } from 'node:path/posix'

import { EXTENSION_SUFFIX_REGEX, PATH_SEP } from '../constant/fsConstants.js'
import {
  INFOLDER_SUFFIX,
  META_REGEX,
  METAFILE_SUFFIX,
} from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { readDirs } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

const INFOLDER_SUFFIX_REGEX = new RegExp(`${INFOLDER_SUFFIX}$`)
export default class InFolderHandler extends StandardHandler {
  @log
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyFolderMetaFile()
    await this._copySpecialExtension()
  }

  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    this._collectFolderMetaCopies(result.copies)
    await this._collectSpecialExtensionCopies(result.copies)
    return result
  }

  protected _collectFolderMetaCopies(
    copies: import('../types/handlerResult.js').CopyOperation[]
  ): void {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]

    const suffix = folderName.endsWith(INFOLDER_SUFFIX)
      ? ''
      : `.${this.element.type.suffix!.toLowerCase()}`

    const folderFileName = `${folderName}${suffix}${METAFILE_SUFFIX}`
    this._collectCopyWithMetaFile(copies, join(folderPath, folderFileName))
  }

  protected async _collectSpecialExtensionCopies(
    copies: import('../types/handlerResult.js').CopyOperation[]
  ): Promise<void> {
    const parsedLine = parse(this.element.basePath)
    const dirContent = await readDirs(parsedLine.dir, this.config)

    for (const file of dirContent) {
      if (file.includes(parsedLine.name)) {
        this._collectCopyWithMetaFile(copies, file)
      }
    }
  }

  protected async _copyFolderMetaFile() {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]

    const suffix = folderName.endsWith(INFOLDER_SUFFIX)
      ? ''
      : `.${this.element.type.suffix!.toLowerCase()}`

    const folderFileName = `${folderName}${suffix}${METAFILE_SUFFIX}`

    await this._copyWithMetaFile(join(folderPath, folderFileName))
  }

  protected async _copySpecialExtension() {
    const parsedLine = parse(this.element.basePath)
    const dirContent = await readDirs(parsedLine.dir, this.config)

    await Promise.all(
      dirContent
        .filter((file: string) => file.includes(parsedLine.name))
        .map((file: string) => this._copyWithMetaFile(file))
    )
  }

  protected override _getElementName() {
    return this.element.pathAfterType
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')
  }

  protected override _isProcessable() {
    return (
      super._isProcessable() ||
      this._parentFolderIsNotTheType() ||
      this.element.extension!.endsWith(INFOLDER_SUFFIX)
    )
  }
}
