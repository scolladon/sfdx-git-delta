'use strict'
import { join, parse } from 'node:path/posix'
import { EXTENSION_SUFFIX_REGEX, PATH_SEP } from '../constant/fsConstants.js'
import {
  INFOLDER_SUFFIX,
  INFOLDER_SUFFIX_REGEX,
  META_REGEX,
  METAFILE_SUFFIX,
} from '../constant/metadataConstants.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import StandardHandler from './standardHandler.js'

export default class InFolderHandler extends StandardHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    const copies = [...result.copies]
    this._collectFolderMetaCopies(copies)
    await this._collectComponentCopies(copies)
    return { ...result, copies }
  }

  protected _collectFolderMetaCopies(copies: CopyOperation[]): void {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]

    const suffix = folderName.endsWith(INFOLDER_SUFFIX)
      ? ''
      : `.${this.element.type.suffix!.toLowerCase()}`

    const folderFileName = `${folderName}${suffix}${METAFILE_SUFFIX}`
    this._collectCopyWithMetaFile(copies, join(folderPath, folderFileName))
  }

  protected async _collectComponentCopies(
    copies: CopyOperation[]
  ): Promise<void> {
    if (!this._shouldCollectCopies()) return
    const componentPath = this._getComponentPath()
    await this._collectExactNameCopy(copies, componentPath)
    this._collectComponentCopy(copies, componentPath)
  }

  // The base path without its last extension: the path every file of the
  // changed component starts with.
  protected _getComponentPath(): string {
    const { dir, name } = parse(this.element.basePath)
    return join(dir, name)
  }

  protected override _getElementName() {
    return this.element.pathAfterType
      .join(PATH_SEP)
      .replace(
        META_REGEX,
        // Stryker disable next-line StringLiteral -- equivalent: replacing the META_REGEX match with any non-empty string is cleaned up by the EXTENSION_SUFFIX_REGEX strip below, so the final element name is identical
        ''
      )
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
