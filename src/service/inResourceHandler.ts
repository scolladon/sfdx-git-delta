'use strict'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'
import { pathExists } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

export default class ResourceHandler extends StandardHandler {
  protected metadataName: string | undefined

  public override async collectAddition(): Promise<HandlerResult> {
    this.metadataName = this._getMetadataName()
    const result = await super.collectAddition()
    const copies = [...result.copies]
    this._collectResourceCopies(copies)
    return { ...result, copies }
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    this.metadataName = this._getMetadataName()
    const componentPath = this.metadataName!
    const exists = await pathExists(componentPath, this.ctx)
    if (exists) {
      return await this.collectModification()
    }
    return await super.collectDeletion()
  }

  protected _collectResourceCopies(copies: CopyOperation[]): void {
    if (!this._shouldCollectCopies()) return

    copies.push({
      kind: CopyOperationKind.GitComponentCopy,
      path: this.metadataName!,
      revision: this.config.to,
    })
  }

  protected override _getElementName() {
    return this.element.pathAfterType.length > 1
      ? this.element.pathAfterType[0]
      : this.element.componentName
  }

  protected override _isProcessable() {
    return true
  }

  protected _getMetadataName(): string {
    return this.element.componentPath
  }

  protected override _getMetaTypeFilePath() {
    return `${this.metadataName}.${this.element.type.suffix}${METAFILE_SUFFIX}`
  }

  protected override _shouldCopyMetaFile(): boolean {
    return true
  }
}
