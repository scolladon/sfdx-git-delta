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
    if (!this.config.generateDelta) return

    const data = fs.readFileSync(path.join(this.config.repo, this.line), {
      encoding: 'utf8',
    })
    if (!!data && data.includes(SubCustomObjectHandler.MASTER_DETAIL_TAG)) {
      const customObjectDirPath = this.splittedLine
        .slice(0, [this.splittedLine.indexOf(this.type)])
        .join(path.sep)
      const customObjectName = this.splittedLine[
        this.splittedLine.indexOf(this.type) - 1
      ]

      const customObjectPath = path.join(
        customObjectDirPath,
        `${customObjectName}.${CustomObjectHandler.OBJECT_META_XML_SUFFIX}`
      )

      this.promises.push(
        fse.copy(
          path.join(this.config.repo, customObjectPath),
          path.join(this.config.output, customObjectPath)
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
