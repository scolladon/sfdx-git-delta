'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')

class InFolderHandler extends StandardHandler {
  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set()
    this.diffs[this.type].add(
      this.splittedLine

        .slice(this.splittedLine.indexOf(this.type) + 1)
        .join(path.sep)
        .replace(StandardHandler.METAFILE_SUFFIX, '')
        .replace(`.${this.metadata[this.type].suffix}`, '')
    )
  }
}

module.exports = InFolderHandler
