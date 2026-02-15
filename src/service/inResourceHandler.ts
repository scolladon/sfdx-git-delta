'use strict'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { pathExists, readDirs } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

export default class ResourceHandler extends StandardHandler {
  protected metadataName: string | undefined

  public override async collectAddition(): Promise<HandlerResult> {
    this.metadataName = this._getMetadataName()
    const result = await super.collectAddition()
    await this._collectResourceCopies(result.copies)
    return result
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    this.metadataName = this._getMetadataName()
    const componentPath = this.metadataName!
    const exists = await pathExists(componentPath, this.config)
    if (exists) {
      return await this.collectModification()
    }
    return await super.collectDeletion()
  }

  protected async _collectResourceCopies(
    copies: import('../types/handlerResult.js').CopyOperation[]
  ): Promise<void> {
    if (!this._shouldCollectCopies()) return

    const staticResourcePath = this.metadataName!.substring(
      0,
      this.metadataName!.lastIndexOf(PATH_SEP)
    )
    const allStaticResources = await readDirs(staticResourcePath, this.config)

    const startsWithMetadataName = new RegExp(
      `${this.metadataName!}[${PATH_SEP}${DOT}]`
    )
    const resourceFiles = allStaticResources.filter((file: string) =>
      startsWithMetadataName.test(file)
    )
    for (const resourceFile of resourceFiles) {
      this._collectCopy(copies, resourceFile)
    }
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
    return this.element.componentBasePath
  }

  protected override _getMetaTypeFilePath() {
    return `${this.metadataName}.${this.element.type.suffix}${METAFILE_SUFFIX}`
  }

  protected override _shouldCopyMetaFile(): boolean {
    return true
  }
}
