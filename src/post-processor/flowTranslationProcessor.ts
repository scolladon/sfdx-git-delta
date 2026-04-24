'use strict'
import { join, parse } from 'node:path/posix'
import type { Writable } from 'node:stream'

import { castArray } from 'lodash-es'

import {
  FLOW_XML_NAME,
  META_REGEX,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { HandlerResult } from '../types/handlerResult.js'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { grepContent } from '../utils/fsHelper.js'
import { isSamePath, isSubDir, pathExists, readFile } from '../utils/fsUtils.js'
import { buildIgnoreHelper, IgnoreHelper } from '../utils/ignoreHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import type { RootCapture } from '../utils/metadataDiff/xmlEventReader.js'
import { writeXmlDocument } from '../utils/metadataDiff/xmlWriter.js'
import {
  ATTRIBUTE_PREFIX,
  parseXmlFileToJson,
  XML_HEADER_ATTRIBUTE_KEY,
  type XmlContent,
  xml2Json,
} from '../utils/xmlHelper.js'
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

const buildTranslationWriter = (
  translation: TranslationsContent
): ((out: Writable) => Promise<void>) => {
  const rootCapture = buildRootCapture(translation)
  const rootChildren = buildRootChildren(translation)
  return async (out: Writable) => {
    await writeXmlDocument(out, rootCapture, rootChildren)
  }
}

const buildRootCapture = (translation: TranslationsContent): RootCapture => {
  const declContent = translation[XML_HEADER_ATTRIBUTE_KEY] as
    | XmlContent
    | undefined
  const xmlHeader =
    declContent === undefined
      ? undefined
      : { [XML_HEADER_ATTRIBUTE_KEY]: declContent }
  const rootKey = 'Translations'
  const translations = (translation.Translations ?? {}) as XmlContent
  const rootAttributes: Record<string, string> = {}
  for (const key of Object.keys(translations)) {
    if (key.startsWith(ATTRIBUTE_PREFIX)) {
      rootAttributes[key] = String(translations[key])
    }
  }
  return { xmlHeader, rootKey, rootAttributes }
}

const buildRootChildren = (
  translation: TranslationsContent
): [string, unknown][] => {
  const translations = (translation.Translations ?? {}) as XmlContent
  const entries: [string, unknown][] = []
  for (const key of Object.keys(translations)) {
    if (key.startsWith(ATTRIBUTE_PREFIX)) continue
    entries.push([key, translations[key]])
  }
  return entries
}

export default class FlowTranslationProcessor extends BaseProcessor {
  protected readonly translations: Map<string, FlowDefinition[]>
  protected ignoreHelper: IgnoreHelper | undefined
  protected isOutputEqualsToRepo: boolean | undefined
  protected packagedFlows: Set<string> = new Set()

  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.translations = new Map()
  }

  override get isCollector(): boolean {
    return true
  }

  @log
  public override async process() {
    // No-op: FlowTranslationProcessor is handled via transformAndCollect()
  }

  public override async transformAndCollect(): Promise<HandlerResult> {
    if (!this._shouldProcess()) {
      return emptyResult()
    }

    await this._buildFlowDefinitionsMap()
    return await this._collectFlowTranslations()
  }

  async _buildFlowDefinitionsMap() {
    this.translations.clear()
    // Cache the package-flow set once per process() invocation — avoids
    // re-computing the union-view of ChangeSet for every parsed flow.
    // _shouldProcess() has already checked has(FLOW_XML_NAME), so get cannot
    // return undefined here.
    this.packagedFlows = this.work.changes
      .forPackageManifest()
      .get(FLOW_XML_NAME)!

    const pathspecs = this.config.source.map(
      s => `${s}/*${EXTENSION}${METAFILE_SUFFIX}`
    )
    const translationPaths = await grepContent(
      'flowDefinitions',
      pathspecs,
      this.work.config
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

  protected async _collectFlowTranslations(): Promise<HandlerResult> {
    const result = emptyResult()

    for (const translationPath of this.translations.keys()) {
      result.manifests.push({
        target: ManifestTarget.Package,
        type: TRANSLATION_TYPE,
        member: getTranslationName(translationPath),
        changeKind: ChangeKind.Modify,
      })
      if (this.config.generateDelta) {
        const jsonTranslation =
          await this._getTranslationAsJSON(translationPath)
        this._scrapTranslationFile(
          jsonTranslation,
          this.translations.get(translationPath)!
        )
        result.copies.push({
          kind: CopyOperationKind.StreamedContent,
          path: translationPath,
          writer: buildTranslationWriter(jsonTranslation),
        })
      }
    }

    return result
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
    const fullName = flowDefinition?.fullName
    if (fullName && this.packagedFlows.has(fullName)) {
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

  protected _shouldProcess() {
    return this.work.changes.forPackageManifest().has(FLOW_XML_NAME)
  }
}
