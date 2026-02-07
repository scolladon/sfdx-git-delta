'use strict'
import { join, parse } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type {
  HandlerResult,
  ManifestElement,
  ManifestTarget,
} from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type { MetadataElement } from '../utils/metadataElement.js'

import StandardHandler from './standardHandler.js'

export default class SharedFolderHandler extends StandardHandler {
  protected readonly sharedFolderMetadata: Map<string, string>

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    this.sharedFolderMetadata = element.getSharedFolderMetadata()
  }

  protected override _collectManifestElement(
    target: ManifestTarget
  ): ManifestElement {
    const type = this.sharedFolderMetadata.get(this.element.extension)
    return {
      target,
      type: type!,
      member: this._getElementName(),
    }
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

  protected override _isProcessable() {
    return (
      super._isProcessable() ||
      this.sharedFolderMetadata.has(this.element.extension)
    )
  }

  protected override _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}${parsedPath.ext}${METAFILE_SUFFIX}`
    )
  }
}
