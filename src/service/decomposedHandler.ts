'use strict'
import { dirname, join } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import StandardHandler from './standardHandler.js'

export default class DecomposedHandler extends StandardHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    this._collectParentCopies(result.copies)
    return result
  }

  protected _collectParentCopies(
    copies: import('../types/handlerResult.js').CopyOperation[]
  ): void {
    const parentType = this.element.getParentType()
    if (!parentType?.suffix) return

    const parentDirPath = dirname(this.element.typeDirectoryPath)
    const parentTypeName = this.getParentName()
    const parentTypeSuffix = parentType.suffix
    const parentPath = join(
      parentDirPath,
      `${parentTypeName}.${parentTypeSuffix}${METAFILE_SUFFIX}`
    )
    this._collectCopyWithMetaFile(copies, parentPath)
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
