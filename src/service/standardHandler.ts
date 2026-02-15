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
import type { Work } from '../types/work.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import type { MetadataElement } from '../utils/metadataElement.js'

/**
 * Strategy pattern base for metadata type handlers.
 * Each Salesforce metadata type may need unique diff-collection behavior
 * (e.g. custom element naming, parent object detection, deletion warnings).
 * Subclasses override specific hooks (_getElementName, _isProcessable,
 * collectAddition, collectDeletion, etc.) — even thin subclasses that override
 * a single method justify their existence because they are selected at runtime
 * by TypeHandlerFactory based on metadata type definitions.
 */
export default class StandardHandler {
  protected readonly config: Config

  constructor(
    protected readonly changeType: string,
    protected readonly element: MetadataElement,
    protected readonly work: Work
  ) {
    this.config = work.config
  }

  @log
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

  protected _getElementName() {
    return this.element.componentName
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
    if (this.config.generateDelta && this._delegateFileCopy()) {
      this._collectCopy(copies, src)
      if (this._shouldCopyMetaFile(src)) {
        this._collectCopy(copies, this._getMetaTypeFilePath(src))
      }
    }
  }

  protected _collectCopy(copies: CopyOperation[], path: string): void {
    copies.push({
      kind: CopyOperationKind.GitCopy,
      path,
      revision: this.config.to,
    })
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
