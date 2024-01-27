'use strict'
import { parse, join } from 'path'

import { METAFILE_SUFFIX } from '../constant/metadataConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { getSharedFolderMetadata } from '../metadata/metadataManager'
import { Manifest, Work } from '../types/work'
import { fillPackageWithParameter } from '../utils/packageHelper'

import StandardHandler from './standardHandler'

export default class SharedFolderHandler extends StandardHandler {
  protected readonly sharedFolderMetadata: Map<string, string>

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
