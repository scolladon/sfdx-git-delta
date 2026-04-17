'use strict'
import { join, parse } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type {
  HandlerResult,
  ManifestElement,
  ManifestTarget,
} from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type { MetadataElement } from '../utils/metadataElement.js'

import StandardHandler from './standardHandler.js'

export default class SharedFolderHandler extends StandardHandler {
  protected readonly resolvedType: string | undefined

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this.resolvedType = element.getSharedFolderMetadata().get(element.extension)
  }

  protected override _collectManifestElement(
    target: ManifestTarget
  ): ManifestElement {
    /* v8 ignore next 5 -- collectAddition/Deletion guard ensures resolvedType is set */
    if (!this.resolvedType) {
      throw new Error(
        `SharedFolderHandler: resolvedType is missing for ${this.element.fullPath}`
      )
    }
    return {
      target,
      type: this.resolvedType,
      member: this._getElementName(),
    }
  }

  public override async collectAddition(): Promise<HandlerResult> {
    if (!this.resolvedType) return emptyResult()
    return await super.collectAddition()
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    if (!this.resolvedType) return emptyResult()
    return await super.collectDeletion()
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
