'use strict'
import { join, parse } from 'node:path/posix'
import type { Writable } from 'node:stream'

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
import { grepContent, readPathFromGit } from '../utils/fsHelper.js'
import { isSamePath, isSubDir, pathExists, readFile } from '../utils/fsUtils.js'
import { buildIgnoreHelper, IgnoreHelper } from '../utils/ignoreHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import {
  parseFromSideSwallowing,
  type RootCapture,
} from '../utils/metadataDiff/xmlEventReader.js'
import { writeXmlDocument } from '../utils/metadataDiff/xmlWriter.js'
import type { XmlContent } from '../utils/xmlHelper.js'
import BaseProcessor from './baseProcessor.js'

const FLOW_DEFINITIONS_KEY = 'flowDefinitions'
const TRANSLATIONS_ROOT_KEY = 'Translations'
const TRANSLATIONS_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'
const DEFAULT_XML_HEADER: XmlContent = {
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
}
const DEFAULT_ROOT_ATTRIBUTES: Record<string, string> = {
  '@_xmlns': TRANSLATIONS_NAMESPACE,
}

const EXTENSION = `.${TRANSLATION_EXTENSION}`

interface FlowDefinition {
  fullName?: string
  [key: string]: unknown
}

// Accumulator built by stream-parsing an existing output translation file.
// Preserves the document-order of direct-child subTypes so the writer can
// emit them in the original sequence. flowDefinitions is tracked separately
// because it gets merged with this.translations[path] before the write.
type TranslationMerge = {
  rootCapture: RootCapture
  orderedChildren: Array<[string, unknown[]]>
  flowsIndex: number
}

const getTranslationName = (translationPath: string) =>
  parse(translationPath.replace(META_REGEX, '')).name

const emptyTranslationMerge = (): TranslationMerge => ({
  rootCapture: {
    xmlHeader: DEFAULT_XML_HEADER,
    rootKey: TRANSLATIONS_ROOT_KEY,
    rootAttributes: DEFAULT_ROOT_ATTRIBUTES,
  },
  orderedChildren: [[FLOW_DEFINITIONS_KEY, []]],
  flowsIndex: 0,
})

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
        const merge = await this._mergeTranslationWithOutput(translationPath)
        this._mergeActualFlows(merge, this.translations.get(translationPath)!)
        result.copies.push({
          kind: CopyOperationKind.StreamedContent,
          path: translationPath,
          writer: async (out: Writable) => {
            await writeXmlDocument(
              out,
              merge.rootCapture,
              merge.orderedChildren
            )
          },
        })
      }
    }

    return result
  }

  /**
   * Stream-parses the existing output translation file (if any), bucketing
   * each direct-child element into an ordered-children list keyed by
   * subType. The streaming builder drops each element from the in-progress
   * tree on close so peak memory is bounded by the current element rather
   * than the full translation document. Non-flowDefinitions children are
   * retained as-is; flowDefinitions are merged downstream with the
   * per-path actual flows we collected from the to-revision translation.
   */
  protected async _mergeTranslationWithOutput(
    translationPath: string
  ): Promise<TranslationMerge> {
    const outputPath = join(this.config.output, translationPath)
    if (!(await pathExists(outputPath))) return emptyTranslationMerge()
    const xml = await readFile(outputPath)
    const orderedChildren: Array<[string, unknown[]]> = []
    const indexByKey = new Map<string, number>()
    const capture = await parseFromSideSwallowing(xml, (subType, element) => {
      let idx = indexByKey.get(subType)
      if (idx === undefined) {
        idx = orderedChildren.length
        indexByKey.set(subType, idx)
        orderedChildren.push([subType, []])
      }
      orderedChildren[idx]![1].push(element)
    })
    if (capture === null) return emptyTranslationMerge()
    let flowsIndex = indexByKey.get(FLOW_DEFINITIONS_KEY)
    if (flowsIndex === undefined) {
      flowsIndex = orderedChildren.length
      orderedChildren.push([FLOW_DEFINITIONS_KEY, []])
    }
    return { rootCapture: capture, orderedChildren, flowsIndex }
  }

  /**
   * Appends actual flows from the to-revision translation into the merge's
   * flowDefinitions bucket, skipping any whose fullName is already present
   * in the output-side flows (output-wins-on-conflict — matches the
   * legacy `_scrapTranslationFile` semantics).
   */
  protected _mergeActualFlows(
    merge: TranslationMerge,
    actualFlowDefinitions: FlowDefinition[]
  ): void {
    const bucket = merge.orderedChildren[
      merge.flowsIndex
    ]![1] as FlowDefinition[]
    const seen = new Set(bucket.map(flowDef => flowDef?.fullName))
    for (const flowDef of actualFlowDefinitions) {
      if (seen.has(flowDef?.fullName)) continue
      bucket.push(flowDef)
    }
  }

  // Uses the streaming xmlEventReader so non-flowDefinitions direct
  // children of the Translations root (customFieldTranslations, etc.)
  // are discarded as they are emitted, and flowDefinitions whose
  // fullName is not in packagedFlows never reach this.translations.
  // The callback-level early-filter makes _addFlowPerTranslation a
  // plain append.
  //
  // Note: per DESIGN Q2 the underlying parser still materialises the
  // full tree before the callbacks fire — the memory win is bounded by
  // packagedFlows size, not by peak-element size. A per-element
  // memory-bounded parse requires a subclassable output-builder in
  // @nodable/compact-builder and is tracked separately.
  protected async _parseTranslationFile(translationPath: string) {
    const source = await readPathFromGit(
      { path: translationPath, oid: this.config.to },
      this.config
    )
    await parseFromSideSwallowing(source, (subType, element) => {
      if (subType !== FLOW_DEFINITIONS_KEY) return
      const flowDefinition = element as FlowDefinition
      if (!flowDefinition.fullName) return
      if (!this.packagedFlows.has(flowDefinition.fullName)) return
      this._addFlowPerTranslation({ translationPath, flowDefinition })
    })
  }

  // Caller has already filtered by packagedFlows; this is pure append.
  protected _addFlowPerTranslation({
    translationPath,
    flowDefinition,
  }: {
    translationPath: string
    flowDefinition: FlowDefinition
  }) {
    if (!this.translations.has(translationPath)) {
      this.translations.set(translationPath, [])
    }
    this.translations.get(translationPath)!.push(flowDefinition)
  }

  protected _shouldProcess() {
    return this.work.changes.forPackageManifest().has(FLOW_XML_NAME)
  }
}
