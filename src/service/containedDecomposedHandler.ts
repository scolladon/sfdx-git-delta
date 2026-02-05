'use strict'
import { join, ParsedPath, parse } from 'node:path/posix'
import { PATH_SEP } from '../constant/fsConstants.js'
import {
  METAFILE_SUFFIX,
  PERMISSIONSET_OBJECTSETTINGS_FOLDER,
} from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { Metadata } from '../types/metadata.js'
import { Work } from '../types/work.js'
import { readDirs } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

export default class ContainedDecomposedHandler extends StandardHandler {
  protected holderFolder: ParsedPath | undefined

  constructor(
    line: string,
    metadataDef: Metadata,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, metadataDef, work, metadata)
    this._setholderFolder()
  }

  @log
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    // For decomposed format, copy all related files
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
    const index =
      parentFolderName === PERMISSIONSET_OBJECTSETTINGS_FOLDER ? -2 : -1

    this.holderFolder = parse(this.splittedLine.slice(0, index).join(PATH_SEP))
  }

  protected _isDecomposedFormat() {
    return (
      !this.parsedLine.base.includes(`.${this.metadataDef.suffix}`) ||
      this.parsedLine.dir.split(PATH_SEP).pop() === this.parsedLine.name
    )
  }

  protected _getHolderPath(): string {
    return join(this.holderFolder?.dir ?? '', this.holderFolder?.base ?? '')
  }

  protected async _hasRelatedContent(): Promise<boolean> {
    const files = await readDirs(this._getHolderPath(), this.config)
    return files.length > 0
  }

  protected async _copyDecomposedFiles() {
    await this._copy(this._getHolderPath())
  }

  protected override _getElementName() {
    return this.holderFolder?.base ?? ''
  }

  protected override _isProcessable() {
    return true
  }
}
