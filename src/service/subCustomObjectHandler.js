'use strict'
const StandardHandler = require('./standardHandler')
const {
  MASTER_DETAIL_TAG,
  OBJECT_META_XML_SUFFIX,
} = require('../utils/metadataConstants')
const { readFile } = require('../utils/fsHelper')
const { join, sep } = require('path')

class SubCustomObjectHandler extends StandardHandler {
  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    const data = await readFile(this.line)
    if (data?.includes(MASTER_DETAIL_TAG)) {
      const customObjectDirPath = this.splittedLine
        .slice(0, [this.splittedLine.indexOf(this.type)])
        .join(sep)
      const customObjectName =
        this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

      const customObjectPath = join(
        customObjectDirPath,
        `${customObjectName}.${OBJECT_META_XML_SUFFIX}`
      )

      await this._copyWithMetaFile(
        join(this.config.repo, customObjectPath),
        join(this.config.output, customObjectPath)
      )
    }
  }

  _fillPackage(packageObject) {
    if (!packageObject.has(this.type)) {
      packageObject.set(this.type, new Set())
    }

    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]
    const elementName = this._getElementName()

    packageObject.get(this.type).add(`${prefix}.${elementName}`)
  }
}

module.exports = SubCustomObjectHandler
