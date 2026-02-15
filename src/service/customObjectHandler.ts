'use strict'
import { join, parse } from 'node:path/posix'

import {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import asyncFilter from '../utils/asyncFilter.js'
import { pathExists, readDirs, readPathFromGit } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

export default class CustomObjectHandler extends StandardHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    await this._collectMasterDetailCopies(result)
    return result
  }

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

    const fields = await readDirs(fieldsFolder, this.config)
    const masterDetailsFields = await asyncFilter(
      fields,
      async (path: string) => {
        const content = await readPathFromGit(
          { path, oid: this.config.to },
          this.config
        )
        return content.includes(MASTER_DETAIL_TAG)
      }
    )
    for (const masterDetailField of masterDetailsFields) {
      this._collectCopyWithMetaFile(result.copies, masterDetailField)
    }
  }
}
