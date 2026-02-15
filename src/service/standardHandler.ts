'use strict'
import { join, parse } from 'node:path/posix'

import { ADDITION, DELETION, MODIFICATION } from '../constant/gitConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { Config } from '../types/config.js'
import type { Manifest, Manifests, Work } from '../types/work.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { copyFiles } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'

export default class StandardHandler {
  protected readonly diffs: Manifests
  protected readonly config: Config
  protected readonly warnings: Error[]

  constructor(
    protected readonly changeType: string,
    protected readonly element: MetadataElement,
    protected readonly work: Work
  ) {
    this.diffs = work.diffs
    this.config = work.config
    this.warnings = work.warnings
  }

  protected _getRevision(): string {
    return this.changeType === DELETION ? this.config.from : this.config.to
  }

  @log
  public async handle() {
    if (this._isProcessable()) {
      try {
        switch (this.changeType) {
          case ADDITION:
            await this.handleAddition()
            break
          case DELETION:
            await this.handleDeletion()
            break
          case MODIFICATION:
            await this.handleModification()
            break
        }
      } catch (error) {
        const message = `${this.element.basePath}: ${getErrorMessage(error)}`
        Logger.warn(lazy`${message}`)
        this.warnings.push(wrapError(message, error))
      }
    }
  }

  @log
  public async handleAddition() {
    Logger.info(
      lazy`${this.element.type.xmlName!}.${() => this._getElementName()} created`
    )
    this._fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    await this._copyWithMetaFile(this.element.basePath)
  }

  @log
  public async handleDeletion() {
    Logger.info(
      lazy`${this.element.type.xmlName!}.${() => this._getElementName()} deleted`
    )
    this._fillPackage(this.diffs.destructiveChanges)
  }

  @log
  public async handleModification() {
    Logger.info(
      lazy`${this.element.type.xmlName!}.${() => this._getElementName()} modified`
    )
    await this.handleAddition()
  }

  protected _getElementName() {
    return this.element.componentName
  }

  protected _fillPackage(store: Manifest) {
    fillPackageWithParameter({
      store,
      type: this.element.type.xmlName!,
      member: this._getElementName(),
    })
  }

  protected async _copyWithMetaFile(src: string) {
    if (this._delegateFileCopy()) {
      await this._copy(src)
      if (this._shouldCopyMetaFile(src)) {
        await this._copy(this._getMetaTypeFilePath(src))
      }
    }
  }

  protected async _copy(elementPath: string) {
    if (this._delegateFileCopy()) {
      await copyFiles(this.config, elementPath)
    }
  }

  protected _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${this.element.type.suffix}${METAFILE_SUFFIX}`
    )
  }

  protected _shouldCopyMetaFile(path: string): boolean {
    return (
      this.element.type.metaFile === true &&
      !`${path}`.endsWith(METAFILE_SUFFIX)
    )
  }

  protected _isProcessable() {
    return this.element.type.suffix === this.element.extension
  }

  protected _delegateFileCopy() {
    return true
  }

  protected _parentFolderIsNotTheType() {
    return this.element.parentFolder !== this.element.type.directoryName
  }

  public toString() {
    return `${this.constructor.name}: ${this.changeType} -> ${this.element.basePath}`
  }
}
