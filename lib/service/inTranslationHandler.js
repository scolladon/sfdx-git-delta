'use strict'
const ResourceHandler = require('./inResourceHandler')
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')

class TranslationHandler extends ResourceHandler {
  handleAddition() {
    StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return
    const objectTranslationName = `${path.parse(this.line).dir}${path.sep}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${mc.OBJECT_TRANSLATION_META_XML_SUFFIX}`
    this._copyFiles(
      path.normalize(path.join(this.config.repo, objectTranslationName)),
      path.normalize(path.join(this.config.output, objectTranslationName))
    )
  }
}

module.exports = TranslationHandler
