'use strict'
const StandardHandler = require('./standardHandler')
const { fillPackageWithParameter } = require('../utils/packageHelper')
const { getSharedFolderMetadata } = require('../metadata/metadataManager')
const { METAFILE_SUFFIX } = require('../utils/metadataConstants')
const { parse, join } = require('path')

class SharedFolderHandler extends StandardHandler {
  sharedFolderMetadata

  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
    this.sharedFolderMetadata = getSharedFolderMetadata(this.metadata)
  }

  _fillPackage(store) {
    const type = this.sharedFolderMetadata.get(this.ext)
    fillPackageWithParameter({
      store,
      type: type,
      member: this._getElementName(),
    })
  }

  _isProcessable() {
    return super._isProcessable() || this.sharedFolderMetadata.has(this.ext)
  }

  _getMetaTypeFilePath(path) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}${parsedPath.ext}${METAFILE_SUFFIX}`
    )
  }
}

module.exports = SharedFolderHandler
