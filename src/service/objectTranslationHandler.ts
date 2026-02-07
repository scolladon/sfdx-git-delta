'use strict'
import { parse } from 'node:path/posix'

import { PATH_SEP } from '../constant/fsConstants.js'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants.js'
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
    const inFileMetadata = this.element.getInFileAttributes()
    const metadataDiff = new MetadataDiff(this.config, inFileMetadata)
    const { toContent, fromContent } = await metadataDiff.compare(path)
    const { xmlContent } = metadataDiff.prune(toContent, fromContent)
    await writeFile(path, xmlContent, this.config)
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
