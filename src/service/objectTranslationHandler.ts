'use strict'
import { parse } from 'node:path/posix'
import { PATH_SEP } from '../constant/fsConstants.js'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'
import type ChangeSet from '../utils/changeSet.js'
import MetadataDiff from '../utils/metadataDiff/index.js'
import ResourceHandler from './inResourceHandler.js'
import StandardHandler from './standardHandler.js'

export default class ObjectTranslationHandler extends ResourceHandler {
  public override async collectAddition(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    const result = await StandardHandler.prototype.collectAddition.call(
      this,
      sink
    )
    if (!this._shouldCollectCopies()) return result

    // RATIONALE: Why include objectTranslation file even when pruned content is empty?
    // fieldTranslation elements are not deployable without their parent objectTranslation.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#object-translations
    const objectTranslationPath = this._getObjectTranslationPath()
    const writer = await this._getObjectTranslationWriter(objectTranslationPath)
    if (writer) {
      result.copies.push({
        kind: CopyOperationKind.StreamedContent,
        path: objectTranslationPath,
        writer,
      })
    }
    return result
  }

  protected async _getObjectTranslationWriter(path: string) {
    const inFileMetadata = this.element.getInFileAttributes()
    const metadataDiff = new MetadataDiff(this.config, inFileMetadata)
    const outcome = await metadataDiff.run(path)
    return outcome.writer
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
