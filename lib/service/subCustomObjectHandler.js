'use strict'
const StandardHandler = require('./standardHandler')

class SubCustomObjectHandler extends StandardHandler {
  handle() {
    if (this.handlerMap[this.changeType]) {
      this.handlerMap[this.changeType].apply(this)
    }
  }

  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this._getElementName()

    this.diffs[this.type].add(`${prefix}.${elementName}`)
  }
}

module.exports = SubCustomObjectHandler
