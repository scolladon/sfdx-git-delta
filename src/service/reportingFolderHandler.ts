'use strict'

import { join } from 'node:path/posix'
import type { TreeIndexes } from '../adapter/gitTreeLister.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { Config } from '../types/config.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import InFolderHandler from './inFolderHandler.js'

export default class ReportingFolderHandler extends InFolderHandler {
  protected readonly resolvedType: string | undefined

  constructor(
    changeType: string,
    element: MetadataElement,
    config: Config,
    treeIndexes?: TreeIndexes
  ) {
    super(changeType, element, config, treeIndexes)
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

  protected override _collectFolderMetaCopies(copies: CopyOperation[]): void {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]
    const folderFileName = `${folderName}${METAFILE_SUFFIX}`
    this._collectCopyWithMetaFile(copies, join(folderPath, folderFileName))
  }

  public override getElementDescriptor(): { type: string; member: string } {
    // Stryker disable ConditionalExpression,BlockStatement,StringLiteral -- equivalent: TypeHandlerFactory routes by extension via SharedFolderMetadata, so a handler instantiated as ReportingFolderHandler always has a known extension; resolvedType being undefined is unreachable in practice
    /* v8 ignore next 5 -- defensive: see stryker disable comment above */
    if (!this.resolvedType) {
      throw new Error(
        `ReportingFolderHandler: resolvedType is missing for ${this.element.fullPath}`
      )
    }
    // Stryker restore ConditionalExpression,BlockStatement,StringLiteral
    return {
      type: this.resolvedType,
      member: this._getElementName(),
    }
  }
}
