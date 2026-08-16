'use strict'
import { join, parse } from 'node:path/posix'
import {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} from '../constant/metadataConstants.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import { grepContentUnder, pathExists } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

export default class CustomObjectHandler extends StandardHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    const copies = [...result.copies]
    await this._collectMasterDetailCopies(copies)
    return { ...result, copies }
  }

  // RATIONALE: Why copy Master Detail fields when deploying CustomObject?
  // Master Detail fields must be included with their parent object for deployment to succeed.
  // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#master-detail-fields
  protected async _collectMasterDetailCopies(
    copies: CopyOperation[]
  ): Promise<void> {
    if (!this._shouldCollectCopies()) return
    if (this.element.type.xmlName !== OBJECT_TYPE) return

    const fieldsFolder = join(
      parse(this.element.basePath).dir,
      FIELD_DIRECTORY_NAME
    )
    const exists = await pathExists(fieldsFolder, this.config, this.treeIndexes)
    // Stryker disable next-line ConditionalExpression -- equivalent: existence guard; flipping to false runs grepContentUnder on a non-existent path which returns [] (gitGrep catch swallows and returns empty), so the for-loop iterates 0 times — observably the same as the early return
    if (!exists) return

    const masterDetailsFields = await grepContentUnder(
      MASTER_DETAIL_TAG,
      fieldsFolder,
      this.config
    )
    for (const masterDetailField of masterDetailsFields) {
      this._collectCopyWithMetaFile(copies, masterDetailField)
    }
  }
}
