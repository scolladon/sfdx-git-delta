'use strict'
import { join, parse } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { getSharedFolderMetadata } from '../metadata/metadataManager.js'
import { Metadata } from '../types/metadata.js'
import type { Manifest, Work } from '../types/work.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'

import StandardHandler from './standardHandler.js'

export default class SharedFolderHandler extends StandardHandler {
  protected readonly sharedFolderMetadata: Map<string, string>

  constructor(
    line: string,
    metadataDef: Metadata,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, metadataDef, work, metadata)
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
