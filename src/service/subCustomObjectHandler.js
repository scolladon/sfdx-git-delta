'use strict'
const StandardHandler = require('./standardHandler')
const {
  MASTER_DETAIL_TAG,
  OBJECT_META_XML_SUFFIX,
} = require('../utils/metadataConstants')
const { join, sep } = require('path')

class SubCustomObjectHandler extends StandardHandler {
  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  async handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const data = await this._readFile()
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

      this._copyFiles(
        join(this.config.repo, customObjectPath),
        join(this.config.output, customObjectPath)
      )
    }
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] ?? new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this._getElementName()

    packageObject[this.type].add(`${prefix}.${elementName}`)
  }

  static SUB_OBJECT_TYPES = [
    'businessProcesses',
    'compactLayouts',
    'fieldSets',
    'fields',
    'listViews',
    'recordTypes',
    'rules',
    'sharingReasons',
    'territories',
    'validationRules',
    'webLinks',
  ]
}

module.exports = SubCustomObjectHandler
