'use strict'
import { parse } from 'path'

import { PATH_SEP } from '../constant/fsConstants'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants'
import { writeFile } from '../utils/fsHelper'
import MetadataDiff from '../utils/metadataDiff'

import ResourceHandler from './inResourceHandler'
import StandardHandler from './standardHandler'

export default class ObjectTranslationHandler extends ResourceHandler {
  public override async handleAddition() {
    await StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return

    const objectTranslationPath = this._getObjectTranslationPath()
    await this._copyObjectTranslation(objectTranslationPath)
  }

  protected async _copyObjectTranslation(path: string) {
    const metadataDiff = new MetadataDiff(this.config, this.metadata)
    await metadataDiff.compare(path)
    const { xmlContent } = metadataDiff.prune()
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
