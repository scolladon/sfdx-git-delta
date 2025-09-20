'use strict'

import { join } from 'node:path/posix'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { getSharedFolderMetadata } from '../metadata/metadataManager.js'
import { Metadata } from '../types/metadata.js'
import type { Manifest, Work } from '../types/work.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import InFolderHandler from './inFolderHandler.js'

export default class ReportingFolderHandler extends InFolderHandler {
  /* jscpd:ignore-start */
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
  /* jscpd:ignore-end */

  protected override async _copyFolderMetaFile() {
    const [, folderPath, folderName] = this._parseLine()!
    const folderFileName = `${folderName}${METAFILE_SUFFIX}`
    await this._copyWithMetaFile(join(folderPath, folderFileName))
  }

  protected override _fillPackage(store: Manifest) {
    const type = this.sharedFolderMetadata.get(this.ext!) as string
    fillPackageWithParameter({
      store,
      type: type,
      member: this._getElementName(),
    })
  }
}
