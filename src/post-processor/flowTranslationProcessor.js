'use strict'
const BaseProcessor = require('./baseProcessor')
const {
  FLOW_DIRECTORY_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} = require('../utils/metadataConstants')
const { copyFiles, scanExtension, readFile } = require('../utils/fsHelper')
const { parse, resolve } = require('path')
const { XMLParser } = require('fast-xml-parser')
const { asArray, XML_PARSER_OPTION } = require('../utils/fxpHelper')
const { fillPackageWithParameter } = require('../utils/packageHelper')

const getTranslationName = translationPath =>
  parse(translationPath.replace(META_REGEX, '')).name

class FlowTranslationProcessor extends BaseProcessor {
  translationPaths

  constructor(work, metadata) {
    super(work, metadata)
    this.translationPaths = new Set()
  }

  async process() {
    await this._buildFlowDefinitionsMap()
    await this._handleFlowTranslation()
  }

  async _buildFlowDefinitionsMap() {
    this.translationPaths.clear()

    const translationsIterator = scanExtension(
      this.config.repo,
      `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`
    )

    for await (const translationPath of translationsIterator) {
      const translationName = getTranslationName(translationPath)
      if (
        // Treat only not already added translation files
        !this.work.diffs.package.get(TRANSLATION_TYPE)?.has(translationName)
      ) {
        const translationXML = await readFile(translationPath)
        const xmlParser = new XMLParser(XML_PARSER_OPTION)
        const translationJSON = xmlParser.parse(translationXML)
        // implement other kind of metadata here
        const flowDefinitions = asArray(
          translationJSON?.Translations?.flowDefinitions
        )
        flowDefinitions.forEach(flowDefinition =>
          this._addFlowPerTranslation({
            translationPath,
            fullName: flowDefinition.fullName,
          })
        )
      }
    }
  }

  async _handleFlowTranslation() {
    const copyTranslationsPromises = []
    for (const translationPath of this.translationPaths.keys()) {
      fillPackageWithParameter({
        package: this.work.diffs.package,
        type: TRANSLATION_TYPE,
        elementName: getTranslationName(translationPath),
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
      this.translationPaths.add(translationPath)
    }
  }
}

module.exports = FlowTranslationProcessor
