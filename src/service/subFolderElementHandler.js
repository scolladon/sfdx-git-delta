'use strict'
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')

class SubFolderElementHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const fileName = this.splittedLine
      .slice(this.splittedLine.length - 1)
      .join(path.sep)

    if (this.metadata[this.type].metaFile === true) {
      this._copyFiles(
        path.join(this.config.repo, fileName + mc.METAFILE_SUFFIX),
        path.join(this.config.output, fileName + mc.METAFILE_SUFFIX)
      )
    }
  }

  _getParsedPath() {
    return path.parse(
      this.splittedLine
        .slice(this.splittedLine.length - 1)
        .join(path.sep)
        .replace(mc.META_REGEX, '')
    )
  }
}

module.exports = SubFolderElementHandler
