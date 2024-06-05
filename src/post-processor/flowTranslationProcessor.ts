/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict'
import { parse, join } from 'path'

import { pathExists } from 'fs-extra'

import {
  FLOW_XML_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} from '../constant/metadataConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import type { Work } from '../types/work'
import { writeFile, readDir } from '../utils/fsHelper'
import { isSubDir, readFile, treatPathSep } from '../utils/fsUtils'
import {
  asArray,
  parseXmlFileToJson,
  xml2Json,
  convertJsonToXml,
} from '../utils/fxpHelper'
import { IgnoreHelper } from '../utils/ignoreHelper'
import { fillPackageWithParameter } from '../utils/packageHelper'

import BaseProcessor from './baseProcessor'

const EXTENSION = `.${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`

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
  protected readonly translations: Map<string, any>

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
    const ignoreHelper = await IgnoreHelper.getIgnoreInstance(this.config)
    const translationPaths = allFiles.filter((file: string) =>
      file.endsWith(EXTENSION)
    )

    for (const translationPath of translationPaths) {
      if (
        ignoreHelper.keep(translationPath) &&
        !isSubDir(this.config.output, translationPath)
      ) {
        await this._parseTranslationFile(translationPath)
      }
    }
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
    jsonTranslation: any,
    actualFlowDefinition: any
  ) {
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
