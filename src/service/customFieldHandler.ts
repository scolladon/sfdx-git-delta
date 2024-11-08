'use strict'
import { join } from 'path/posix'

import { PATH_SEP } from '../constant/fsConstants'
import {
  MASTER_DETAIL_TAG,
  OBJECT_META_XML_SUFFIX,
} from '../constant/metadataConstants'
import { readPathFromGit } from '../utils/fsHelper'

import DecomposedHandler from './decomposedHandler'

export default class CustomFieldHandler extends DecomposedHandler {
  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    // QUESTION: Why we need to add parent object for Master Detail field ? https://help.salesforce.com/s/articleView?id=000386883&type=1
    const data = await readPathFromGit(
      { path: this.line, oid: this.config.to },
      this.config
    )
    if (!data.includes(MASTER_DETAIL_TAG)) return

    const customObjectDirPath = this.splittedLine
      .slice(0, this.splittedLine.indexOf(this.metadataDef.directoryName))
      .join(PATH_SEP)
    const customObjectName =
      this.splittedLine[
        this.splittedLine.indexOf(this.metadataDef.directoryName) - 1
      ]

    const customObjectPath = join(
      customObjectDirPath,
      `${customObjectName}.${OBJECT_META_XML_SUFFIX}`
    )

    await this._copyWithMetaFile(customObjectPath)
  }
}
