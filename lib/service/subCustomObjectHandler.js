'use strict'
const metadata = require('../metadata/metadata')('directoryName')
const StandardHandler = require('./standardHandler')

class SubCustomObjectHandler extends StandardHandler {
  handle() {
    if (this.handlerMap[this.changeType]) {
      this.handlerMap[this.changeType].apply(this)
    }
  }

  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set()
    const prefix = `${
      this.splittedLine[this.splittedLine.indexOf(this.type) - 1]
    }`

    const elementName = this.splittedLine[
      this.splittedLine.indexOf(this.type) + 1
    ]
      .replace(StandardHandler.METAFILE_SUFFIX, '')
      .replace(`.${metadata[this.type].suffix}`, '')

    this.diffs[this.type].add(`${prefix}.${elementName}`)
  }
}

module.exports = SubCustomObjectHandler
