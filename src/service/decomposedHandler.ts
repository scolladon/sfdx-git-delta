'use strict'
import { dirname, join } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

export default class DecomposedHandler extends StandardHandler {
  @log
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyParent()
  }

  protected async _copyParent() {
    const parentDirPath = dirname(this.element.typeDirectoryPath)
    const parentTypeName = this.getParentName()

    const parentType = this.element.getParentType()
    const parentTypeSuffix = parentType!.suffix

    const parentPath = join(
      parentDirPath,
      `${parentTypeName}.${parentTypeSuffix}${METAFILE_SUFFIX}`
    )

    await this._copyWithMetaFile(parentPath)
  }

  protected override _getElementName() {
    const parentTypeSuffix = this.getParentName()
    const elementName = super._getElementName()
    return `${parentTypeSuffix}.${elementName}`
  }

  protected getParentName() {
    return this.element.parentName
  }
}
