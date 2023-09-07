'use strict'
import StandardHandler from './standardHandler'
import { fillPackageWithParameter } from '../utils/packageHelper'
import { getSharedFolderMetadata } from '../metadata/metadataManager'
import { METAFILE_SUFFIX } from '../utils/metadataConstants'
import { parse, join } from 'path'
import { Manifest, Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'

export default class SharedFolderHandler extends StandardHandler {
  protected readonly sharedFolderMetadata

  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
    this.sharedFolderMetadata = getSharedFolderMetadata(this.metadata)
  }

  protected override _fillPackage(store: Manifest) {
    const type = this.sharedFolderMetadata.get(this.ext!) as string
    fillPackageWithParameter({
      store,
      type: type,
      member: this._getElementName(),
    })
  }

  protected override _isProcessable() {
    return super._isProcessable() || this.sharedFolderMetadata.has(this.ext)
  }

  protected override _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}${parsedPath.ext}${METAFILE_SUFFIX}`
    )
  }
}
