'use strict'
import { join, parse } from 'node:path/posix'

import {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} from '../constant/metadataConstants.js'
import asyncFilter from '../utils/asyncFilter.js'
import { pathExists, readDirs, readPathFromGit } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

export default class CustomObjectHandler extends StandardHandler {
  @log
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._handleMasterDetailException()
  }

  protected async _handleMasterDetailException() {
    if (this.element.type.xmlName !== OBJECT_TYPE) return

    const fieldsFolder = join(
      parse(this.element.basePath).dir,
      FIELD_DIRECTORY_NAME
    )
    const exists = await pathExists(fieldsFolder, this.config)
    if (!exists) return

    // QUESTION: Why we need to add parent object for Master Detail field ? https://help.salesforce.com/s/articleView?id=000386883&type=1
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
      await this._copyWithMetaFile(masterDetailField)
    }
  }
}
