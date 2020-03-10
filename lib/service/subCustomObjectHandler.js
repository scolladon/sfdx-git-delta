'use strict'
const StandardHandler = require('./standardHandler')
const CustomObjectHandler = require('./customObjectHandler')
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')

class SubCustomObjectHandler extends StandardHandler {
  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleAddition() {
    super.handleAddition()

    const fieldContent = fs.readFileSync(
      path.join(this.config.repo, this.line),
      { encoding: 'utf8' }
    )
    if (
      !!fieldContent &&
      fieldContent.includes(SubCustomObjectHandler.MASTER_DETAIL_TAG)
    ) {
      const customObjectPath = this.splittedLine
        .slice(0, [this.splittedLine.indexOf(this.type)])
        .join(path.sep)
      const customObject = this.splittedLine[
        this.splittedLine.indexOf(this.type) - 1
      ]

      const commonPath = `${customObjectPath + path.sep + customObject}.${
        CustomObjectHandler.OBJECT_META_XML_SUFFIX
      }`

      this.promises.push(
        fse.copy(
          path.join(this.config.repo, commonPath),
          path.join(this.config.output, commonPath)
        )
      )
    }
  }
  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] || new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this._getElementName()

    packageObject[this.type].add(`${prefix}.${elementName}`)
  }
}

SubCustomObjectHandler.MASTER_DETAIL_TAG = '<type>MasterDetail</type>'
module.exports = SubCustomObjectHandler
