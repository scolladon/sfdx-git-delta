'use strict'
const ResourceHandler = require('./inResourceHandler')
const StandardHandler = require('./standardHandler')
const {
  OBJECT_TRANSLATION_META_XML_SUFFIX,
} = require('../utils/metadataConstants')
const { join, normalize, parse, sep } = require('path')

class TranslationHandler extends ResourceHandler {
  async handleAddition() {
    await StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return
    const objectTranslationName = `${parse(this.line).dir}${sep}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
    await this._copyFiles(
      normalize(join(this.config.repo, objectTranslationName)),
      normalize(join(this.config.output, objectTranslationName))
    )
  }
}

module.exports = TranslationHandler
