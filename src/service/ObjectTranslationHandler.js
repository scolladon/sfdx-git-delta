'use strict'
const ResourceHandler = require('./inResourceHandler')
const StandardHandler = require('./standardHandler')
const {
  OBJECT_TRANSLATION_META_XML_SUFFIX,
} = require('../utils/metadataConstants')
const { parse, sep } = require('path')

class ObjectTranslationHandler extends ResourceHandler {
  async handleAddition() {
    await StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return
    await this._copyObjectTranslation()
  }

  async _copyObjectTranslation() {
    const objectTranslationName = `${parse(this.line).dir}${sep}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
    await this._copyWithMetaFile(objectTranslationName)
  }
}

module.exports = ObjectTranslationHandler
