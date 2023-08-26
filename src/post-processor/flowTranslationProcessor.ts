/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict'
import BaseProcessor from './baseProcessor'
import {
  FLOW_XML_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} from '../utils/metadataConstants'
import { writeFile, scanExtension, isSubDir, readFile } from '../utils/fsHelper'
import { pathExists } from 'fs-extra'
import { parse, join } from 'path'
import { buildIgnoreHelper } from '../utils/ignoreHelper'
import {
  asArray,
  parseXmlFileToJson,
  xml2Json,
  convertJsonToXml,
} from '../utils/fxpHelper'
import { fillPackageWithParameter } from '../utils/packageHelper'
import { treatPathSep } from '../utils/childProcessUtils'
import { Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'

const EXTENSION = `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`

const getTranslationName = (translationPath: string) =>
  parse(translationPath.replace(META_REGEX, '')).name

const getDefaultTranslation = () => ({
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Translations: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    flowDefinitions: [],
  },
})

export default class FlowTranslationProcessor extends BaseProcessor {
  translationPaths: Map<string, any>

  constructor(work: Work, metadata: MetadataRepository) {
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

    const translationsIterator = await scanExtension(
      this.config.source,
      EXTENSION,
      this.work.config
    )

    const ignoreHelper = await buildIgnoreHelper(this.config)

    for (const translationPath of translationsIterator) {
      if (
        !ignoreHelper?.globalIgnore?.ignores(translationPath) &&
        !isSubDir(this.config.output, translationPath)
      ) {
        await this._parseTranslationFile(translationPath)
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
        const jsonTranslation =
          await this._getTranslationAsJSON(translationPath)
        this._scrapTranslationFile(
          jsonTranslation,
          this.translationPaths.get(translationPath)
        )
        const scrappedTranslation = convertJsonToXml(jsonTranslation)
        await writeFile(translationPath, scrappedTranslation, this.config)
      }
    }
  }

  _scrapTranslationFile(jsonTranslation: any, actualFlowDefinition: any) {
    const flowDefinitions = asArray(
      jsonTranslation.Translations?.flowDefinitions
    )
    const fullNames = new Set(
      flowDefinitions.map((flowDef: any) => flowDef?.fullName)
    )
    const strippedActualFlowDefinition = actualFlowDefinition.filter(
      (flowDef: any) => !fullNames.has(flowDef?.fullName)
    )

    jsonTranslation.Translations.flowDefinitions = flowDefinitions.concat(
      strippedActualFlowDefinition
    )
  }

  async _parseTranslationFile(translationPath: string) {
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

  _addFlowPerTranslation({
    translationPath,
    flowDefinition,
  }: {
    translationPath: string
    flowDefinition: any
  }) {
    const packagedElements = this.work.diffs.package.get(FLOW_XML_NAME)
    if (packagedElements?.has(flowDefinition?.fullName)) {
      if (!this.translationPaths.has(translationPath)) {
        this.translationPaths.set(translationPath, [])
      }
      this.translationPaths.get(translationPath).push(flowDefinition)
    }
  }

  async _getTranslationAsJSON(translationPath: string) {
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

    return jsonTranslation
  }

  _shouldProcess() {
    return this.work.diffs.package.has(FLOW_XML_NAME)
  }
}
