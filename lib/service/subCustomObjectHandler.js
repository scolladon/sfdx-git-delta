'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')

const OBJECT_META_XML_SUFFIX = `object${StandardHandler.METAFILE_SUFFIX}`
const MASTER_DETAIL_TAG = '<type>MasterDetail</type>'

class SubCustomObjectHandler extends StandardHandler {
  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this._getElementName()

    this.diffs[this.type].add(`${prefix}.${elementName}`)
  }

  handleAddtion() {
    super.handleAddtion()

    const fieldContent = fs.readFileSync(path.join(this.config.repo, this.line))
    if (fieldContent.includes(MASTER_DETAIL_TAG)) {
      const customObjectPath = this.splittedLine
        .slice(0, [this.splittedLine.indexOf(this.type)])
        .join(path.sep)
      const customObject = this.splittedLine[
        this.splittedLine.indexOf(this.type) - 1
      ]

      const commonPath = `${customObjectPath +
        path.sep +
        customObject}.${OBJECT_META_XML_SUFFIX}`

      this.promises.push(
        fse.copy(
          path.join(this.config.repo, commonPath),
          path.join(this.config.output, commonPath)
        )
      )
    }
  }
}

module.exports = SubCustomObjectHandler
