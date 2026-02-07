'use strict'
import { join, ParsedPath, parse } from 'node:path/posix'
import { PATH_SEP } from '../constant/fsConstants.js'
import {
  METAFILE_SUFFIX,
  PERMISSIONSET_OBJECTSETTINGS_FOLDER,
} from '../constant/metadataConstants.js'
import type { Work } from '../types/work.js'
import { readDirs } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import StandardHandler from './standardHandler.js'

export default class ContainedDecomposedHandler extends StandardHandler {
  protected holderFolder: ParsedPath | undefined

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this._setholderFolder()
  }

  @log
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    if (this._isDecomposedFormat()) {
      await this._copyDecomposedFiles()
    }
  }

  @log
  public override async handleDeletion() {
    if (!this._isDecomposedFormat()) {
      await super.handleDeletion()
      return
    }

    if (await this._hasRelatedContent()) {
      await this.handleModification()
    } else {
      await super.handleDeletion()
    }
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
    const parts = this.element.fullPath.split(PATH_SEP)
    const parentFolderName = parts.at(-2)

    const index =
      parentFolderName === PERMISSIONSET_OBJECTSETTINGS_FOLDER ? -2 : -1

    this.holderFolder = parse(parts.slice(0, index).join(PATH_SEP))
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

  protected async _copyDecomposedFiles() {
    await this._copy(this._getHolderPath())
  }

  protected override _getElementName() {
    return this.holderFolder!.base
  }

  protected override _isProcessable() {
    return true
  }
}
