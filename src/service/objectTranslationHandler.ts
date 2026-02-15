'use strict'
import { parse } from 'node:path/posix'

import { PATH_SEP } from '../constant/fsConstants.js'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants.js'
import { getInFileAttributes } from '../metadata/metadataManager.js'
import { writeFile } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import MetadataDiff from '../utils/metadataDiff.js'
import ResourceHandler from './inResourceHandler.js'
import StandardHandler from './standardHandler.js'

export default class ObjectTranslationHandler extends ResourceHandler {
  @log
  public override async handleAddition() {
    await StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return

    const objectTranslationPath = this._getObjectTranslationPath()
    await this._copyObjectTranslation(objectTranslationPath)
  }

  protected async _copyObjectTranslation(path: string) {
    const inFileMetadata = getInFileAttributes(this.metadata)
    const metadataDiff = new MetadataDiff(this.config, inFileMetadata)
    const { toContent, fromContent } = await metadataDiff.compare(path)
    const { xmlContent } = metadataDiff.prune(toContent, fromContent)
    await writeFile(path, xmlContent, this.config)
  }

  protected _getObjectTranslationPath() {
    // Return Object Translation Path for both objectTranslation and fieldTranslation
    // QUESTION: Why fieldTranslation element are not deployable when objectTranslation element is not in the deployed sources (even if objectTranslation file is empty) ?
    return `${parse(this.line).dir}${PATH_SEP}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
  }

  protected override _delegateFileCopy() {
    return !this.line.endsWith(OBJECT_TRANSLATION_META_XML_SUFFIX)
  }
}
