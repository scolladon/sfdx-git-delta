'use strict'
import { parse } from 'node:path/posix'

import { PATH_SEP } from '../constant/fsConstants.js'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import MetadataDiff, { type PrunedContent } from '../utils/metadataDiff.js'
import ResourceHandler from './inResourceHandler.js'
import StandardHandler from './standardHandler.js'

export default class ObjectTranslationHandler extends ResourceHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await StandardHandler.prototype.collectAddition.call(this)
    if (!this._shouldCollectCopies()) return result

    // RATIONALE: Why include objectTranslation file even when pruned content is empty?
    // fieldTranslation elements are not deployable without their parent objectTranslation.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#object-translations
    const objectTranslationPath = this._getObjectTranslationPath()
    const { xmlContent } = await this._getObjectTranslationContent(
      objectTranslationPath
    )
    this._collectComputedContent(
      result.copies,
      objectTranslationPath,
      xmlContent
    )
    return result
  }

  protected async _getObjectTranslationContent(
    path: string
  ): Promise<PrunedContent> {
    const inFileMetadata = this.element.getInFileAttributes()
    const metadataDiff = new MetadataDiff(this.config, inFileMetadata)
    const { toContent, fromContent } = await metadataDiff.compare(path)
    return metadataDiff.prune(toContent, fromContent)
  }

  protected _getObjectTranslationPath() {
    return `${parse(this.element.basePath).dir}${PATH_SEP}${
      this.element.parts[this.element.parts.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
  }

  protected override _delegateFileCopy() {
    return !this.element.fullPath.endsWith(OBJECT_TRANSLATION_META_XML_SUFFIX)
  }

  protected override _getElementName() {
    return this.element.pathAfterType[0]
  }
}
