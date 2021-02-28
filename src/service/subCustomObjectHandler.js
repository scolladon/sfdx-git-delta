'use strict'
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')

class SubCustomObjectHandler extends StandardHandler {
  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const data = this._readFileSync()
    if (data?.includes(mc.MASTER_DETAIL_TAG)) {
      const customObjectDirPath = this.splittedLine
        .slice(0, [this.splittedLine.indexOf(this.type)])
        .join(path.sep)
      const customObjectName = this.splittedLine[
        this.splittedLine.indexOf(this.type) - 1
      ]

      const customObjectPath = path.join(
        customObjectDirPath,
        `${customObjectName}.${mc.OBJECT_META_XML_SUFFIX}`
      )

      this._copyFiles(
        path.join(this.config.repo, customObjectPath),
        path.join(this.config.output, customObjectPath)
      )
    }
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] ?? new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this._getElementName()

    packageObject[this.type].add(`${prefix}.${elementName}`)
  }
}

module.exports = SubCustomObjectHandler
