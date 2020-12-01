'use strict'
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')

class SubFolderElementHandler extends StandardHandler {
  _getParsedPath() {
    return path.parse(
      this.splittedLine
        .slice(this.splittedLine.length - 1)
        .join(path.sep)
        .replace(mc.META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }
}

module.exports = SubFolderElementHandler
