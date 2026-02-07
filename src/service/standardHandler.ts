'use strict'
import { join, parse } from 'node:path/posix'

import { ADDITION, DELETION, MODIFICATION } from '../constant/gitConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { Config } from '../types/config.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import {
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../types/handlerResult.js'
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

  public async collect(): Promise<HandlerResult> {
    if (!this._isProcessable()) {
      return emptyResult()
    }
    try {
      switch (this.changeType) {
        case ADDITION:
          return await this.collectAddition()
        case DELETION:
          return await this.collectDeletion()
        case MODIFICATION:
          return await this.collectModification()
        default:
          return emptyResult()
      }
    } catch (error) {
      const message = `${this.element.basePath}: ${getErrorMessage(error)}`
      Logger.warn(lazy`${message}`)
      return {
        manifests: [],
        copies: [],
        warnings: [wrapError(message, error)],
      }
    }
  }

  public async collectAddition(): Promise<HandlerResult> {
    const result = emptyResult()
    result.manifests.push(this._collectManifestElement(ManifestTarget.Package))
    this._collectCopyWithMetaFile(result.copies, this.element.basePath)
    return result
  }

  public async collectDeletion(): Promise<HandlerResult> {
    const result = emptyResult()
    result.manifests.push(
      this._collectManifestElement(ManifestTarget.DestructiveChanges)
    )
    return result
  }

  public async collectModification(): Promise<HandlerResult> {
    return await this.collectAddition()
  }

  protected _collectManifestElement(target: ManifestTarget) {
    return {
      target,
      type: this.element.type.xmlName!,
      member: this._getElementName(),
    }
  }

  protected _collectCopyWithMetaFile(
    copies: CopyOperation[],
    src: string
  ): void {
    if (this._delegateFileCopy()) {
      this._collectCopy(copies, src)
      if (this._shouldCopyMetaFile(src)) {
        this._collectCopy(copies, this._getMetaTypeFilePath(src))
      }
    }
  }

  protected _collectCopy(copies: CopyOperation[], path: string): void {
    if (this._delegateFileCopy()) {
      copies.push({
        kind: CopyOperationKind.GitCopy,
        path,
        revision: this.config.to,
      })
    }
  }

  public toString() {
    return `${this.constructor.name}: ${this.changeType} -> ${this.element.basePath}`
  }
}
