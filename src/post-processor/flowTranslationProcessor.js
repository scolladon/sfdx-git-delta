'use strict'
const BaseProcessor = require('./baseProcessor')
const {
  FLOW_XML_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} = require('../utils/metadataConstants')
const {
  writeFile,
  scanExtension,
  isSubDir,
  readFile,
} = require('../utils/fsHelper')
const { pathExists } = require('fs-extra')
const { parse, join } = require('path')
const { forPath } = require('../utils/ignoreHelper')
const {
  asArray,
  parseXmlFileToJson,
  xml2Json,
  convertJsonToXml,
} = require('../utils/fxpHelper')
const { fillPackageWithParameter } = require('../utils/packageHelper')
const { treatPathSep } = require('../utils/childProcessUtils')

const getTranslationName = translationPath =>
  parse(translationPath.replace(META_REGEX, '')).name

const EXTENSION = `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`

const getDefaultTranslation = () => ({
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Translations: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    flowDefinitions: [],
  },
})

class FlowTranslationProcessor extends BaseProcessor {
  translationPaths

  constructor(work, metadata) {
    super(work, metadata)
    this.translationPaths = new Map()
  }

  async process() {
    if (this._shouldProcess()) {
      await this._buildFlowDefinitionsMap()
      await this._handleFlowTranslation()
    }
  }

  async _buildFlowDefinitionsMap() {
    this.translationPaths.clear()

    const translationsIterator = scanExtension(
      this.config.source,
      EXTENSION,
      this.work.config
    )

    const ign = await this._getIgnoreInstance()

    for await (const translationPath of translationsIterator) {
      if (
        !ign?.ignores(translationPath) &&
        !isSubDir(this.config.output, translationPath)
      ) {
        this._parseTranslationFile(translationPath)
      }
    }
  }

  async _handleFlowTranslation() {
    for (const translationPath of this.translationPaths.keys()) {
      fillPackageWithParameter({
        store: this.work.diffs.package,
        type: TRANSLATION_TYPE,
        member: getTranslationName(translationPath),
      })
      if (this.config.generateDelta) {
        this._scrapTranslationFile(translationPath)
      }
    }
  }

  async _scrapTranslationFile(translationPath) {
    const translationPathInOutputFolder = join(
      this.config.output,
      treatPathSep(translationPath)
    )
    const translationExist = await pathExists(translationPathInOutputFolder)

    let jsonTranslation = getDefaultTranslation()
    if (translationExist) {
      const xmlTranslation = await readFile(translationPathInOutputFolder)
      jsonTranslation = xml2Json(xmlTranslation)
    }

    const flowDefinitions = jsonTranslation.Translations?.flowDefinitions ?? []
    const fullNames = flowDefinitions.map(flowDef => flowDef.fullName)

    const flowDefinitionsImpacted = this.translationPaths
      .get(translationPath)
      .filter(flowDef => !fullNames.includes(flowDef.fullName))
    jsonTranslation.Translations.flowDefinitions = flowDefinitions.concat(
      flowDefinitionsImpacted
    )

    const xmlTranslation = convertJsonToXml(jsonTranslation)

    await writeFile(translationPath, xmlTranslation, this.config)
  }

  async _parseTranslationFile(translationPath) {
    const translationJSON = await parseXmlFileToJson(
      translationPath,
      this.config
    )
    const flowDefinitions = asArray(
      translationJSON?.Translations?.flowDefinitions
    )
    flowDefinitions.forEach(flowDefinition =>
      this._addFlowPerTranslation({
        translationPath,
        flowDefinition,
      })
    )
  }

  _addFlowPerTranslation({ translationPath, flowDefinition }) {
    const packagedElements = this.work.diffs.package.get(FLOW_XML_NAME)
    if (packagedElements.has(flowDefinition.fullName)) {
      if (!this.translationPaths.has(translationPath)) {
        this.translationPaths.set(translationPath, [])
      }
      this.translationPaths.get(translationPath).push(flowDefinition)
    }
  }

  _shouldProcess() {
    return this.work.diffs.package.has(FLOW_XML_NAME)
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
