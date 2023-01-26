'use strict'
const BaseProcessor = require('./baseProcessor')
const {
  FLOW_DIRECTORY_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} = require('../utils/metadataConstants')
const {
  copyFiles,
  scanExtension,
  readPathFromGit,
  isSubDir,
} = require('../utils/fsHelper')
const { parse } = require('path')
const { forPath } = require('../utils/ignoreHelper')
const { XMLParser } = require('fast-xml-parser')
const { asArray, XML_PARSER_OPTION } = require('../utils/fxpHelper')
const { fillPackageWithParameter } = require('../utils/packageHelper')

const getTranslationName = translationPath =>
  parse(translationPath.replace(META_REGEX, '')).name

const EXTENSION = `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`
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
      this.config.source,
      EXTENSION,
      this.work
    )

    const ign = await this._getIgnoreInstance()

    for await (const translationPath of translationsIterator) {
      const translationName = getTranslationName(translationPath)
      if (
        !this.work.diffs.package.get(TRANSLATION_TYPE)?.has(translationName) &&
        !ign?.ignores(translationPath) &&
        !isSubDir(this.config.output, translationPath)
      ) {
        this._parseTranslationFile(translationName)
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
        copyTranslationsPromises.push(copyFiles(this.config, translationPath))
      }
    }
    await Promise.all(copyTranslationsPromises)
  }

  async _parseTranslationFile(translationPath) {
    const translationXML = await readPathFromGit(translationPath, this.config)

    const xmlParser = new XMLParser(XML_PARSER_OPTION)
    const translationJSON = xmlParser.parse(translationXML)
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

  _addFlowPerTranslation({ translationPath, fullName }) {
    const packagedElements = this.work.diffs.package.get(FLOW_DIRECTORY_NAME)
    if (packagedElements?.has(fullName)) {
      this.translationPaths.add(translationPath)
    }
  }

  async _getIgnoreInstance() {
    let ign
    if (this.config.ignore) {
      ign = await forPath(this.config.ignore)
    }
    return ign
  }
}

module.exports = FlowTranslationProcessor
