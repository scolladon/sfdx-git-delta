'use strict'
import { join, parse } from 'node:path/posix'
import { castArray } from 'lodash-es'

import {
  FLOW_XML_NAME,
  META_REGEX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Work } from '../types/work.js'
import { readDirs, writeFile } from '../utils/fsHelper.js'
import { isSamePath, isSubDir, pathExists, readFile } from '../utils/fsUtils.js'
import {
  convertJsonToXml,
  parseXmlFileToJson,
  xml2Json,
} from '../utils/fxpHelper.js'
import { buildIgnoreHelper, IgnoreHelper } from '../utils/ignoreHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import BaseProcessor from './baseProcessor.js'

const EXTENSION = `.${TRANSLATION_EXTENSION}`

interface FlowDefinition {
  fullName?: string
  [key: string]: unknown
}

interface TranslationsContent {
  '?xml'?: { '@_version': string; '@_encoding': string }
  Translations?: {
    '@_xmlns'?: string
    flowDefinitions?: FlowDefinition | FlowDefinition[]
    [key: string]: unknown
  }
}

const getTranslationName = (translationPath: string) =>
  parse(translationPath.replace(META_REGEX, '')).name

const getDefaultTranslation = (): TranslationsContent => ({
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Translations: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    flowDefinitions: [],
  },
})

export default class FlowTranslationProcessor extends BaseProcessor {
  protected readonly translations: Map<string, FlowDefinition[]>
  protected ignoreHelper: IgnoreHelper | undefined
  protected isOutputEqualsToRepo: boolean | undefined

  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.translations = new Map()
  }

  @log
  public override async process() {
    if (this._shouldProcess()) {
      await this._buildFlowDefinitionsMap()
      await this._handleFlowTranslation()
    }
  }

  async _buildFlowDefinitionsMap() {
    this.translations.clear()

    const allFiles = await readDirs(this.config.source, this.work.config)
    const translationPaths = allFiles.filter((file: string) =>
      file.replace(META_REGEX, '').endsWith(EXTENSION)
    )

    for (const translationPath of translationPaths) {
      if (await this._canParse(translationPath)) {
        await this._parseTranslationFile(translationPath)
      }
    }
  }

  protected async _canParse(translationPath: string) {
    if (!this.ignoreHelper) {
      this.ignoreHelper = await buildIgnoreHelper(this.config)
      this.isOutputEqualsToRepo = isSamePath(
        this.config.output,
        this.config.repo
      )
    }
    return (
      !this.ignoreHelper.globalIgnore.ignores(translationPath) &&
      (this.isOutputEqualsToRepo ||
        !isSubDir(this.config.output, translationPath))
    )
  }

  protected async _handleFlowTranslation() {
    for (const translationPath of this.translations.keys()) {
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
          this.translations.get(translationPath)!
        )
        const scrappedTranslation = convertJsonToXml(jsonTranslation)
        await writeFile(translationPath, scrappedTranslation, this.config)
      }
    }
  }

  protected _scrapTranslationFile(
    jsonTranslation: TranslationsContent,
    actualFlowDefinition: FlowDefinition[]
  ) {
    const flowDefinitions = castArray(
      jsonTranslation.Translations?.flowDefinitions
    ) as FlowDefinition[]
    const fullNames = new Set(
      flowDefinitions.map((flowDef: FlowDefinition) => flowDef?.fullName)
    )
    const strippedActualFlowDefinition = actualFlowDefinition.filter(
      (flowDef: FlowDefinition) => !fullNames.has(flowDef?.fullName)
    )

    jsonTranslation.Translations!.flowDefinitions = flowDefinitions.concat(
      strippedActualFlowDefinition
    )
  }

  protected async _parseTranslationFile(translationPath: string) {
    const translationJSON = (await parseXmlFileToJson(
      { path: translationPath, oid: this.config.to },
      this.config
    )) as TranslationsContent
    const flowDefinitions = castArray(
      translationJSON?.Translations?.flowDefinitions
    ) as FlowDefinition[]
    flowDefinitions.forEach(flowDefinition =>
      this._addFlowPerTranslation({
        translationPath,
        flowDefinition,
      })
    )
  }

  protected _addFlowPerTranslation({
    translationPath,
    flowDefinition,
  }: {
    translationPath: string
    flowDefinition: FlowDefinition
  }) {
    const packagedElements = this.work.diffs.package.get(FLOW_XML_NAME)
    const fullName = flowDefinition?.fullName
    if (fullName && packagedElements?.has(fullName)) {
      if (!this.translations.has(translationPath)) {
        this.translations.set(translationPath, [])
      }
      this.translations.get(translationPath)!.push(flowDefinition)
    }
  }

  protected async _getTranslationAsJSON(
    translationPath: string
  ): Promise<TranslationsContent> {
    const translationPathInOutputFolder = join(
      this.config.output,
      translationPath
    )
    const translationExist = await pathExists(translationPathInOutputFolder)

    let jsonTranslation: TranslationsContent = getDefaultTranslation()
    if (translationExist) {
      const xmlTranslation = await readFile(translationPathInOutputFolder)
      jsonTranslation = xml2Json(xmlTranslation) as TranslationsContent
    }

    return jsonTranslation
  }

  _shouldProcess() {
    return this.work.diffs.package.has(FLOW_XML_NAME)
  }
}
