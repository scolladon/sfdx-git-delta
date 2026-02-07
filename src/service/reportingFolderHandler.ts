'use strict'

import { join } from 'node:path/posix'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type {
  HandlerResult,
  ManifestElement,
  ManifestTarget,
} from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import InFolderHandler from './inFolderHandler.js'

export default class ReportingFolderHandler extends InFolderHandler {
  protected readonly sharedFolderMetadata: Map<string, string>

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this.sharedFolderMetadata = element.getSharedFolderMetadata()
  }

  public override async collectAddition(): Promise<HandlerResult> {
    const type = this.sharedFolderMetadata.get(this.element.extension)
    if (!type) return emptyResult()
    return await super.collectAddition()
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    const type = this.sharedFolderMetadata.get(this.element.extension)
    if (!type) return emptyResult()
    return await super.collectDeletion()
  }

  protected override _collectFolderMetaCopies(
    copies: import('../types/handlerResult.js').CopyOperation[]
  ): void {
    const folderPath = this.element.typeDirectoryPath
    const folderName = this.element.pathAfterType[0]
    const folderFileName = `${folderName}${METAFILE_SUFFIX}`
    this._collectCopyWithMetaFile(copies, join(folderPath, folderFileName))
  }

  protected override _collectManifestElement(
    target: ManifestTarget
  ): ManifestElement {
    const type = this.sharedFolderMetadata.get(this.element.extension)
    return {
      target,
      type: type ?? this.element.type.xmlName!,
      member: this._getElementName(),
    }
  }
}
