'use strict'
const ResourceHandler = require('./inResourceHandler')
const StandardHandler = require('./standardHandler')
const { getInFileAttributs } = require('../metadata/metadataManager')
const {
  OBJECT_TRANSLATION_META_XML_SUFFIX,
} = require('../utils/metadataConstants')
const { writeFile } = require('../utils/fsHelper')
const { parse, sep } = require('path')
const MetadataDiff = require('../utils/metadataDiff')

class ObjectTranslationHandler extends ResourceHandler {
  async handleAddition() {
    await StandardHandler.prototype.handleAddition.apply(this)
    if (!this.config.generateDelta) return

    const objectTranslationPath = this.getObjectTranslationPath()
    await this._copyObjectTranslation(objectTranslationPath)
  }

  async _copyObjectTranslation(path) {
    const inFileMetadata = getInFileAttributs(this.metadata)
    const metadataDiff = new MetadataDiff(
      this.config,
      this.metadata,
      inFileMetadata
    )
    await metadataDiff.compare(path)
    const xmlContent = metadataDiff.prune()
    await writeFile(path, xmlContent, this.config)
  }

  getObjectTranslationPath() {
    // Return Object Translation Path for both objectTranslation and fieldTranslation
    // QUESTION: Why fieldTranslation element are not deployable when objectTanslation element is not in the deployed sources ?
    return `${parse(this.line).dir}${sep}${
      this.splittedLine[this.splittedLine.length - 2]
    }.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
  }
}

module.exports = ObjectTranslationHandler
