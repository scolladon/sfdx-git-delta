'use strict'
import StandardHandler from './standardHandler'
import asyncFilter from '../utils/asyncFilter'
import { pathExists, readDir, readPathFromGit } from '../utils/fsHelper'
import {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} from '../constant/metadataConstants'
import { join, parse } from 'path'

export default class CustomObjectHandler extends StandardHandler {
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._handleMasterDetailException()
  }

  protected async _handleMasterDetailException() {
    if (this.type !== OBJECT_TYPE) return

    const fieldsFolder = join(parse(this.line).dir, FIELD_DIRECTORY_NAME)
    const exists = await pathExists(fieldsFolder, this.config)
    if (!exists) return

    // QUESTION: Why we need to add parent object for Master Detail field ? https://help.salesforce.com/s/articleView?id=000386883&type=1
    const fields = await readDir(fieldsFolder, this.config)
    const masterDetailsFields = await asyncFilter(
      fields,
      async (fieldPath: string) => {
        const content = await readPathFromGit(
          join(fieldsFolder, fieldPath),
          this.config
        )
        return content.includes(MASTER_DETAIL_TAG)
      }
    )

    await Promise.all(
      masterDetailsFields.map((field: string) =>
        this._copyWithMetaFile(join(fieldsFolder, field))
      )
    )
  }
}
