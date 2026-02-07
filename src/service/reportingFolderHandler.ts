'use strict'

import { join } from 'node:path/posix'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { Manifest, Work } from '../types/work.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import InFolderHandler from './inFolderHandler.js'

export default class ReportingFolderHandler extends InFolderHandler {
  protected readonly sharedFolderMetadata: Map<string, string>

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this.sharedFolderMetadata = element.getSharedFolderMetadata()
  }

  protected override async _copyFolderMetaFile() {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]
    const folderFileName = `${folderName}${METAFILE_SUFFIX}`
    await this._copyWithMetaFile(join(folderPath, folderFileName))
  }

  protected override _fillPackage(store: Manifest) {
    const type = this.sharedFolderMetadata.get(this.element.extension)
    if (!type) return

    fillPackageWithParameter({
      store,
      type,
      member: this._getElementName(),
    })
  }
}
