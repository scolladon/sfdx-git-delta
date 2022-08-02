'use strict'
const StandardHandler = require('./standardHandler')
const { UTF8_ENCODING } = require('../utils/gitConstants')
const {
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} = require('../utils/metadataConstants')
const { scan, filterExt } = require('../utils/fsHelper')
const { XML_PARSER_OPTION } = require('../utils/fxpConfig')
const { parse, resolve } = require('path')
const { readFile } = require('fs').promises
const { XMLParser } = require('fast-xml-parser')

const readFileOptions = {
  encoding: UTF8_ENCODING,
}

class FlowTranslationHandler extends StandardHandler {
  static translationsPerFlow

  async handleAddition() {
    await super.handleAddition()
    await this._handleFlowTranslation()
  }

  async _handleFlowTranslation() {
    await this._buildTranslationMap()
    await this._addFlowTranslation()
  }

  async _buildTranslationMap() {
    if (FlowTranslationHandler.translationsPerFlow) return
    const tempMap = new Map()

    const translationsIterator = filterExt(
      scan(this.config.repo),
      `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`
    )

    for await (const translationPath of translationsIterator) {
      const translation = await readFile(translationPath, readFileOptions)
      const xmlParser = new XMLParser(XML_PARSER_OPTION)
      const parsedTranslation = xmlParser.parse(translation)
      if (!parsedTranslation?.Translations?.flowDefinitions) continue

      for (const flowDefinition of parsedTranslation.Translations
        .flowDefinitions) {
        const fullName = flowDefinition.fullName
        if (!tempMap.has(fullName)) {
          tempMap.set(fullName, new Set())
        }
        tempMap.get(fullName).add(translationPath)
      }
    }

    FlowTranslationHandler.translationsPerFlow = tempMap
  }

  async _addFlowTranslation() {
    const flowName = this._getElementName()
    if (!FlowTranslationHandler.translationsPerFlow.has(flowName)) return
    const copyTranslationsPromises = []
    for (const translation of FlowTranslationHandler.translationsPerFlow.get(
      flowName
    )) {
      const translationName = parse(translation.replace(META_REGEX, '')).name
      this._fillPackageWithParameter({
        package: this.diffs.package,
        type: TRANSLATION_TYPE,
        elementName: translationName,
      })
      if (this.config.generateDelta) {
        const source = resolve(this.config.repo, translation)
        const target = resolve(this.config.output, translation)
        copyTranslationsPromises.push(this._copyFiles(source, target))
      }
    }
    await Promise.all(copyTranslationsPromises)
  }
}

module.exports = FlowTranslationHandler
