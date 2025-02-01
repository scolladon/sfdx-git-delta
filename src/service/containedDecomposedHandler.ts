'use strict'
import { ParsedPath, join, parse } from 'node:path/posix'
import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { readDir } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

export default class ContainedDecomposedHandler extends StandardHandler {
  protected holderFolder: ParsedPath | undefined

  public override async handleAddition() {
    await this._setholderFolder()
    await super.handleAddition()
    if (!this.config.generateDelta) return

    // For decomposed format, copy all related files
    if (this._isDecomposedFormat()) {
      await this._copyDecomposedFiles()
    }
  }

  public override async handleDeletion() {
    await this._setholderFolder()
    if (this._isDecomposedFormat()) {
      // Check if any related files/folders still exist
      const hasRelatedContent = await this._hasRelatedContent()

      if (hasRelatedContent) {
        // If there are still related files, treat as modification
        await this.handleModification()
      } else {
        await super.handleDeletion()
      }
    } else {
      await super.handleDeletion()
    }
  }

  protected _setholderFolder() {
    if (this.holderFolder) {
      return
    }

    if (!this._isDecomposedFormat()) {
      this.holderFolder = parse(
        this.line
          .replace(METAFILE_SUFFIX, '')
          .replace(`.${this.metadataDef.suffix}`, '')
      )
      return
    }
    // Get the parent folder name from the path
    const parentFolderName = this.splittedLine.at(-2)

    // If parent folder is objectSettings, use the grandparent folder name
    // Otherwise use the parent folder name
    const index = parentFolderName === 'objectSettings' ? -3 : -2

    this.holderFolder = parse(this.splittedLine.slice(0, index).join(PATH_SEP))
  }

  protected _isDecomposedFormat() {
    return (
      !this.parsedLine.base.includes(`.${this.metadataDef.suffix}`) ||
      this.parsedLine.dir.split(PATH_SEP).pop() === this.parsedLine.name
    )
  }

  protected async _hasRelatedContent(): Promise<boolean> {
    const files = await readDir(
      join(this.holderFolder!.dir, this.holderFolder!.base),
      this.config
    )
    return files.length > 0
  }

  protected async _copyDecomposedFiles() {
    await this._copy(join(this.holderFolder!.dir, this.holderFolder!.base))
  }

  protected override _getElementName() {
    return this.holderFolder!.base
  }

  protected override _isProcessable() {
    return true
  }
}
