'use strict'
import StandardHandler from './standardHandler'
import { fillPackageWithParameter } from '../utils/packageHelper'
import { getSharedFolderMetadata } from '../metadata/metadataManager'
import { METAFILE_SUFFIX } from '../utils/metadataConstants'
import { parse, join } from 'path'

export default class SharedFolderHandler extends StandardHandler {
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
