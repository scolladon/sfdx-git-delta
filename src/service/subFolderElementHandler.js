'use strict'
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')

class subFolderElementHandler extends StandardHandler {
  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const fileName = this.splittedLine.slice((this.splittedLine.length) - 1).join(path.sep)

    this._copyFiles(
      path.join(this.config.repo, fileName),
      path.join(this.config.output, fileName)
    )
  }

  _fillPackage(packageObject) {
  packageObject[this.type] = packageObject[this.type] ?? new Set()
  packageObject[this.type].add(this.splittedLine
      .slice((this.splittedLine.length) - 1)
      .join(path.sep)
      .replace(mc.META_REGEX, ''));
  }
}
module.exports = SubFolderElementHandler