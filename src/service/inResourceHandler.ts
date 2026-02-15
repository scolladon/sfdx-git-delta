'use strict'

import { eachLimit } from 'async'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
import { pathExists, readDirs } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

export default class ResourceHandler extends StandardHandler {
  protected metadataName: string | undefined

  @log
  public override async handleAddition() {
    this.metadataName = this._getMetadataName()
    await super.handleAddition()
    if (!this.config.generateDelta) return

    await this._copyResourceFiles()
  }

  @log
  public override async handleDeletion() {
    this.metadataName = this._getMetadataName()
    const componentPath = this.metadataName!
    const exists = await pathExists(componentPath, this.config)
    if (exists) {
      await this.handleModification()
    } else {
      await super.handleDeletion()
    }
  }

  protected async _copyResourceFiles() {
    const staticResourcePath = this.metadataName!.substring(
      0,
      this.metadataName!.lastIndexOf(PATH_SEP)
    )
    const allStaticResources = await readDirs(
      staticResourcePath,
      this.work.config
    )

    const startsWithMetadataName = new RegExp(
      `${this.metadataName!}[${PATH_SEP}${DOT}]`
    )
    const resourceFiles = allStaticResources.filter((file: string) =>
      startsWithMetadataName.test(file)
    )
    await eachLimit(
      resourceFiles,
      getConcurrencyThreshold(),
      async (resourceFile: string) => this._copy(resourceFile)
    )
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
