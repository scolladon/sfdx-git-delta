'use strict'
import { join, ParsedPath, parse } from 'node:path/posix'
import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { readDirs } from '../utils/fsHelper.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import StandardHandler from './standardHandler.js'

export default class ContainedDecomposedHandler extends StandardHandler {
  protected holderFolder: ParsedPath | undefined

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this._setholderFolder()
  }

  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    if (this._isDecomposedFormat()) {
      this._collectCopy(result.copies, this._getHolderPath())
    }
    return result
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    if (!this._isDecomposedFormat()) {
      return await super.collectDeletion()
    }
    if (await this._hasRelatedContent()) {
      return await this.collectModification()
    }
    return await super.collectDeletion()
  }

  protected _setholderFolder() {
    if (!this._isDecomposedFormat()) {
      this.holderFolder = parse(
        this.element.basePath
          .replace(METAFILE_SUFFIX, '')
          .replace(`.${this.element.type.suffix}`, '')
      )
      return
    }
    this.holderFolder = parse(
      join(this.element.typeDirectoryPath, this.element.pathAfterType[0])
    )
  }

  protected _isDecomposedFormat() {
    const parsed = parse(this.element.basePath)
    return (
      !parsed.base.includes(`.${this.element.type.suffix}`) ||
      parsed.dir.split(PATH_SEP).pop() === parsed.name
    )
  }

  protected _getHolderPath(): string {
    return join(this.holderFolder!.dir, this.holderFolder!.base)
  }

  protected async _hasRelatedContent(): Promise<boolean> {
    const files = await readDirs(this._getHolderPath(), this.config)
    return files.length > 0
  }

  protected override _getElementName() {
    return this.holderFolder!.base
  }

  protected override _isProcessable() {
    return true
  }
}
