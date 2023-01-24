'use strict'
const StandardHandler = require('./standardHandler')
const {
  MASTER_DETAIL_TAG,
  OBJECT_META_XML_SUFFIX,
} = require('../utils/metadataConstants')
const { readPathFromGit } = require('../utils/fsHelper')
const { join, sep } = require('path')

class SubCustomObjectHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    const data = await readPathFromGit(this.line, this.config)
    if (!data?.includes(MASTER_DETAIL_TAG)) return

    const customObjectDirPath = this.splittedLine
      .slice(0, [this.splittedLine.indexOf(this.type)])
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

module.exports = SubCustomObjectHandler
