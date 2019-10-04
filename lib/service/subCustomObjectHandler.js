'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')

class SubCustomObjectHandler extends StandardHandler {
  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this._getElementName()

    this.diffs[this.type].add(`${prefix}.${elementName}`)
  }

  handleAddtion() {
    super.handleAddtion()

    const customObjectPath = this.splittedLine
      .slice(0, [this.splittedLine.indexOf(this.type) - 1])
      .join(path.sep)
    const customObject = this.splittedLine[
      this.splittedLine.indexOf(this.type) - 1
    ]

    const sourceObject = path.join(
      this.config.repo,
      `${customObjectPath}${path.sep}${customObject}.object-meta.xml`
    )
    const targetObject = path.join(
      this.config.output,
      `${customObjectPath}${path.sep}${customObject}.object-meta.xml`
    )

    this.promises.push(fse.copy(sourceObject, targetObject))
  }
}

module.exports = SubCustomObjectHandler
