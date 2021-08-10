import ResourceHandler from './inResourceHandler'
import StandardHandler from './standardHandler'
import {OBJECT_TRANSLATION_META_XML_SUFFIX} from '../utils/metadataConstants'
import { join, normalize, parse, sep } from "path"

export default class TranslationHandler extends ResourceHandler {
  override handleAddition(): void {
    StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return
    const objectTranslationName = `${parse(this.line).dir}${sep}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
    this.copyFiles(
      normalize(join(this.config.repo, objectTranslationName)),
      normalize(join(this.config.output, objectTranslationName))
    )
  }
}
