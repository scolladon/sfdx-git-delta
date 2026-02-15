'use strict'
import { join, parse } from 'node:path/posix'

import {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { grepContent, pathExists } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

export default class CustomObjectHandler extends StandardHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    await this._collectMasterDetailCopies(result)
    return result
  }

  // RATIONALE: Why copy Master Detail fields when deploying CustomObject?
  // Master Detail fields must be included with their parent object for deployment to succeed.
  // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#master-detail-fields
  protected async _collectMasterDetailCopies(
    result: HandlerResult
  ): Promise<void> {
    if (this.element.type.xmlName !== OBJECT_TYPE) return

    const fieldsFolder = join(
      parse(this.element.basePath).dir,
      FIELD_DIRECTORY_NAME
    )
    const exists = await pathExists(fieldsFolder, this.config)
    if (!exists) return

    const masterDetailsFields = await grepContent(
      MASTER_DETAIL_TAG,
      fieldsFolder,
      this.config
    )
    for (const masterDetailField of masterDetailsFields) {
      this._collectCopyWithMetaFile(result.copies, masterDetailField)
    }
  }
}
