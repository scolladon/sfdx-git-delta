'use strict'
const BaseProcessor = require('./baseProcessor')
const { UTF8_ENCODING } = require('../utils/gitConstants')
const {
  FLOW_DIRECTORY_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} = require('../utils/metadataConstants')
const { copyFiles, scanExtension } = require('../utils/fsHelper')
const { XML_PARSER_OPTION } = require('../utils/fxpConfig')
const { parse, resolve } = require('path')
const { readFile } = require('fs').promises
const { XMLParser } = require('fast-xml-parser')
const { fillPackageWithParameter } = require('../utils/packageHelper')

const readFileOptions = {
  encoding: UTF8_ENCODING,
}

class FlowTranslationProcessor extends BaseProcessor {
  flowPerTranslations

  constructor(work, metadata) {
    super(work, metadata)
    this.flowPerTranslations = new Map()
  }

  async process() {
    await this._buildFlowDefinitionsMap()
    await this._handleFlowTranslation()
  }

  async _buildFlowDefinitionsMap() {
    this.flowPerTranslations.clear()

    const translationsIterator = scanExtension(
      this.config.repo,
      `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`
    )

    for await (const translationPath of translationsIterator) {
      const translation = await readFile(translationPath, readFileOptions)
      const xmlParser = new XMLParser(XML_PARSER_OPTION)
      const parsedTranslation = xmlParser.parse(translation)
      // implement other kind of metadata here
      parsedTranslation?.Translations?.flowDefinitions?.forEach(
        flowDefinition =>
          this._addFlowPerTranslation({
            translationPath,
            fullName: flowDefinition.fullName,
          })
      )
    }
  }

  async _handleFlowTranslation() {
    const copyTranslationsPromises = []

    for (const translationPath of this.flowPerTranslations.keys()) {
      const translationName = parse(
        translationPath.replace(META_REGEX, '')
      ).name
      fillPackageWithParameter({
        package: this.work.diffs.package,
        type: TRANSLATION_TYPE,
        elementName: translationName,
      })
      if (this.config.generateDelta) {
        const source = resolve(this.config.repo, translationPath)
        const target = resolve(this.config.output, translationPath)
        copyTranslationsPromises.push(copyFiles(source, target))
      }
    }
    await Promise.all(copyTranslationsPromises)
  }

  _addFlowPerTranslation({ translationPath, fullName }) {
    const packagedElements = this.work.diffs.package.get(FLOW_DIRECTORY_NAME)
    if (packagedElements?.has(fullName)) {
      if (!this.flowPerTranslations.has(translationPath)) {
        this.flowPerTranslations.set(translationPath, new Set())
      }
      this.flowPerTranslations.get(translationPath).add(fullName)
    }
  }
}

module.exports = FlowTranslationProcessor
