'use strict'
import ResourceHandler from './inResourceHandler'
import StandardHandler from './standardHandler'
import { getInFileAttributes } from '../metadata/metadataManager'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants'
import { writeFile } from '../utils/fsHelper'
import { parse, sep } from 'path'
import MetadataDiff from '../utils/metadataDiff'

export default class ObjectTranslationHandler extends ResourceHandler {
  public override async handleAddition() {
    await StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return

    const objectTranslationPath = this._getObjectTranslationPath()
    await this._copyObjectTranslation(objectTranslationPath)
  }

  protected async _copyObjectTranslation(path: string) {
    const inFileMetadata = getInFileAttributes(this.metadata)
    const metadataDiff = new MetadataDiff(
      this.config,
      this.metadata,
      inFileMetadata
    )
    await metadataDiff.compare(path)
    const { xmlContent } = metadataDiff.prune()
    await writeFile(path, xmlContent, this.config)
  }

  protected _getObjectTranslationPath() {
    // Return Object Translation Path for both objectTranslation and fieldTranslation
    // QUESTION: Why fieldTranslation element are not deployable when objectTranslation element is not in the deployed sources (even if objectTranslation file is empty) ?
    return `${parse(this.line).dir}${sep}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
  }

  protected override _delegateFileCopy() {
    return !this.line.endsWith(OBJECT_TRANSLATION_META_XML_SUFFIX)
  }
}
