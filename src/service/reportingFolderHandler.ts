'use strict'

import { join } from 'node:path/posix'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type {
  HandlerResult,
  ManifestElement,
  ManifestTarget,
} from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import InFolderHandler from './inFolderHandler.js'

export default class ReportingFolderHandler extends InFolderHandler {
  protected readonly resolvedType: string | undefined

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this.resolvedType = element.getSharedFolderMetadata().get(element.extension)
  }

  /* jscpd:ignore-start */
  public override async collectAddition(): Promise<HandlerResult> {
    if (!this.resolvedType) return emptyResult()
    return await super.collectAddition()
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    if (!this.resolvedType) return emptyResult()
    return await super.collectDeletion()
  }
  /* jscpd:ignore-end */

  protected override _collectFolderMetaCopies(
    copies: import('../types/handlerResult.js').CopyOperation[]
  ): void {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]
    const folderFileName = `${folderName}${METAFILE_SUFFIX}`
    this._collectCopyWithMetaFile(copies, join(folderPath, folderFileName))
  }

  public override getElementDescriptor(): { type: string; member: string } {
    /* v8 ignore next 5 -- collectAddition/Deletion guard ensures resolvedType is set */
    if (!this.resolvedType) {
      throw new Error(
        `ReportingFolderHandler: resolvedType is missing for ${this.element.fullPath}`
      )
    }
    return {
      type: this.resolvedType,
      member: this._getElementName(),
    }
  }

  protected override _collectManifestElement(
    target: ManifestTarget
  ): ManifestElement {
    return {
      target,
      ...this.getElementDescriptor(),
      changeKind: this._getChangeKind(),
    }
  }
}
