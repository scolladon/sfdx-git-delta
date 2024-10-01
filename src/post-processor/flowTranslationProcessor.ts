'use strict'
import { join, parse } from 'node:path'

import { pathExists } from 'fs-extra'
import {
  FLOW_XML_NAME,
  META_REGEX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Work } from '../types/work.js'
import { readDir, writeFile } from '../utils/fsHelper.js'
import {
  isSamePath,
  isSubDir,
  readFile,
  treatPathSep,
} from '../utils/fsUtils.js'
import {
  asArray,
  convertJsonToXml,
  parseXmlFileToJson,
  xml2Json,
} from '../utils/fxpHelper.js'
import { IgnoreHelper, buildIgnoreHelper } from '../utils/ignoreHelper.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'

import BaseProcessor from './baseProcessor.js'

const EXTENSION = `.${TRANSLATION_EXTENSION}`

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
  // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
  protected readonly translations: Map<string, any>
  protected ignoreHelper: IgnoreHelper | undefined
  protected isOutputEqualsToRepo: boolean | undefined

  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.translations = new Map()
  }

  public override async process() {
    if (this._shouldProcess()) {
      await this._buildFlowDefinitionsMap()
      await this._handleFlowTranslation()
    }
  }

  async _buildFlowDefinitionsMap() {
    this.translations.clear()

    const allFiles = await readDir(this.config.source, this.work.config)
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
          this.translations.get(translationPath)
        )
        const scrappedTranslation = convertJsonToXml(jsonTranslation)
        await writeFile(translationPath, scrappedTranslation, this.config)
      }
    }
  }

  protected _scrapTranslationFile(
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    jsonTranslation: any,
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    actualFlowDefinition: any
  ) {
    const flowDefinitions = asArray(
      jsonTranslation.Translations?.flowDefinitions
    )
    const fullNames = new Set(
      // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
      flowDefinitions.map((flowDef: any) => flowDef?.fullName)
    )
    const strippedActualFlowDefinition = actualFlowDefinition.filter(
      // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
      (flowDef: any) => !fullNames.has(flowDef?.fullName)
    )

    jsonTranslation.Translations.flowDefinitions = flowDefinitions.concat(
      strippedActualFlowDefinition
    )
  }

  protected async _parseTranslationFile(translationPath: string) {
    const translationJSON = await parseXmlFileToJson(
      { path: translationPath, oid: this.config.to },
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

  protected _addFlowPerTranslation({
    translationPath,
    flowDefinition,
  }: {
    translationPath: string
    // biome-ignore lint/suspicious/noExplicitAny: Any is expected here
    flowDefinition: any
  }) {
    const packagedElements = this.work.diffs.package.get(FLOW_XML_NAME)
    if (packagedElements?.has(flowDefinition?.fullName)) {
      if (!this.translations.has(translationPath)) {
        this.translations.set(translationPath, [])
      }
      this.translations.get(translationPath).push(flowDefinition)
    }
  }

  protected async _getTranslationAsJSON(translationPath: string) {
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
