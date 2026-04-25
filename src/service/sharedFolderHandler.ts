'use strict'
import { join, parse } from 'node:path/posix'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type ChangeSet from '../utils/changeSet.js'
import type { MetadataElement } from '../utils/metadataElement.js'

import StandardHandler from './standardHandler.js'

export default class SharedFolderHandler extends StandardHandler {
  protected readonly resolvedType: string | undefined

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this.resolvedType = element.getSharedFolderMetadata().get(element.extension)
  }

  public override getElementDescriptor(): { type: string; member: string } {
    /* v8 ignore next 5 -- collectAddition/Deletion guard ensures resolvedType is set */
    if (!this.resolvedType) {
      throw new Error(
        `SharedFolderHandler: resolvedType is missing for ${this.element.fullPath}`
      )
    }
    return {
      type: this.resolvedType,
      member: this._getElementName(),
    }
  }

  public override async collectAddition(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    if (!this.resolvedType) return emptyResult()
    return await super.collectAddition(sink)
  }

  public override async collectDeletion(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    if (!this.resolvedType) return emptyResult()
    return await super.collectDeletion(sink)
  }

  protected override _isProcessable() {
    return super._isProcessable() || !!this.resolvedType
  }

  protected override _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}${parsedPath.ext}${METAFILE_SUFFIX}`
    )
  }
}
