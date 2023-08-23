'use strict'
import StandardHandler from './standardHandler'
import {
  MASTER_DETAIL_TAG,
  OBJECT_META_XML_SUFFIX,
} from '../utils/metadataConstants'
import { readPathFromGit } from '../utils/fsHelper'
import { join, sep } from 'path'

export default class SubCustomObjectHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    // QUESTION: Why we need to add parent object for Master Detail field ? https://help.salesforce.com/s/articleView?id=000386883&type=1
    const data = await readPathFromGit(this.line, this.config)
    if (!data.includes(MASTER_DETAIL_TAG)) return

    const customObjectDirPath = this.splittedLine
      .slice(0, this.splittedLine.indexOf(this.type))
      .join(sep)
    const customObjectName =
      this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const customObjectPath = join(
      customObjectDirPath,
      `${customObjectName}.${OBJECT_META_XML_SUFFIX}`
    )

    await this._copyWithMetaFile(customObjectPath)
  }

  _getElementName() {
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]
    const elementName = super._getElementName()
    return `${prefix}.${elementName}`
  }
}
