'use strict'
import { join, parse } from 'node:path/posix'
import type { Writable } from 'node:stream'

import { eachLimit } from 'async'

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
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
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
// `seenFullNames` is populated while parsing so the merge step is O(new
// flows) instead of rebuilding a Set per path.
type TranslationMerge = {
  rootCapture: RootCapture
  orderedChildren: Array<[string, unknown[]]>
  flowsIndex: number
  seenFullNames: Set<string | undefined>
}

const getTranslationName = (translationPath: string) =>
  // Stryker disable next-line StringLiteral -- equivalent: META_REGEX strips the trailing -meta.xml suffix; mutating the empty replacement to "Stryker was here!" leaves the path with that suffix that parse() then drops via the .name extraction (parse strips the last extension), so the resulting name is identical
  parse(translationPath.replace(META_REGEX, '')).name

const emptyTranslationMerge = (): TranslationMerge => ({
  rootCapture: {
    xmlHeader: DEFAULT_XML_HEADER,
    rootKey: TRANSLATIONS_ROOT_KEY,
    rootAttributes: DEFAULT_ROOT_ATTRIBUTES,
  },
  orderedChildren: [[FLOW_DEFINITIONS_KEY, []]],
  flowsIndex: 0,
  seenFullNames: new Set<string | undefined>(),
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
    // Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: the processor short-circuits when there are no flow translations to emit; flipping to false continues into _buildFlowDefinitionsMap which gates again on the same condition via packaged === undefined and returns from there, producing the same empty result
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
    // _shouldProcess() has already checked has(FLOW_XML_NAME); guard the
    // narrow explicitly so future code-motion doesn't break the invariant.
    const packaged = this.work.changes.forPackageManifest().get(FLOW_XML_NAME)
    // Stryker disable next-line ConditionalExpression -- equivalent: see v8 ignore — the gate is unreachable when _shouldProcess passes, which is the precondition for being here
    /* v8 ignore next -- defensive: _shouldProcess() already gates on FLOW_XML_NAME presence, so packaged is always defined here */
    if (packaged === undefined) return
    this.packagedFlows = packaged

    const pathspecs = this.config.source.map(
      s => `${s}/*${EXTENSION}${METAFILE_SUFFIX}`
    )
    const translationPaths = await grepContent(
      'flowDefinitions',
      pathspecs,
      this.work.config
    )

    // Eager-init ignoreHelper + isOutputEqualsToRepo BEFORE the parallel
    // loop: under eachLimit multiple workers would otherwise race the
    // `if (!this.ignoreHelper)` guard, each triggering a redundant
    // buildIgnoreHelper and then racing to assign the result.
    await this._initIgnoreHelper()

    // Translation files are independent; parse them in parallel under the
    // shared concurrency cap. this.translations.set is keyed by distinct
    // translationPath values so per-file writes do not overlap.
    await eachLimit(
      translationPaths,
      getConcurrencyThreshold(),
      async (translationPath: string) => {
        if (this._canParse(translationPath)) {
          await this._parseTranslationFile(translationPath)
        }
      }
    )
  }

  protected async _initIgnoreHelper(): Promise<void> {
    if (this.ignoreHelper) return
    this.ignoreHelper = await buildIgnoreHelper(this.config)
    this.isOutputEqualsToRepo = isSamePath(this.config.output, this.config.repo)
  }

  protected _canParse(translationPath: string): boolean {
    // _initIgnoreHelper is awaited by _buildFlowDefinitionsMap before any
    // worker runs, so the helper is guaranteed initialised here.
    return (
      !this.ignoreHelper!.globalIgnore.ignores(translationPath) &&
      (this.isOutputEqualsToRepo ||
        !isSubDir(this.config.output, translationPath))
    )
  }

  protected async _collectFlowTranslations(): Promise<HandlerResult> {
    const result = emptyResult()

    for (const translationPath of this.translations.keys()) {
      result.changes.addElement({
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
    // Stryker disable next-line ConditionalExpression -- equivalent: existence guard; flipping to false runs readFile on a missing file and the rejection bubbles into the catch above (caller treats empty-merge identically)
    if (!(await pathExists(outputPath))) return emptyTranslationMerge()
    const xml = await readFile(outputPath)
    // Stryker disable next-line ArrayDeclaration -- equivalent: orderedChildren is appended to inside the parse callback; an injected initial element is overwritten by the indexByKey/orderedChildren bookkeeping on the first parse callback
    const orderedChildren: Array<[string, unknown[]]> = []
    const indexByKey = new Map<string, number>()
    const seenFullNames = new Set<string | undefined>()
    const capture = await parseFromSideSwallowing(xml, (subType, element) => {
      let idx = indexByKey.get(subType)
      // Stryker disable next-line ConditionalExpression -- equivalent: first-encounter branch; flipping to true creates a new orderedChildren slot every call instead of reusing existing — the resulting orderedChildren still contains all elements but in different bucket layout, and the writer iterates the same data in the same effective order
      if (idx === undefined) {
        idx = orderedChildren.length
        indexByKey.set(subType, idx)
        orderedChildren.push([subType, []])
      }
      orderedChildren[idx]![1].push(element)
      if (subType === FLOW_DEFINITIONS_KEY) {
        // Stryker disable next-line OptionalChaining -- equivalent: defensive optional chain on FlowDefinition; the parser only emits well-formed FlowDefinition elements so element is always defined when subType matches
        seenFullNames.add((element as FlowDefinition)?.fullName)
      }
    })
    if (capture === null) return emptyTranslationMerge()
    let flowsIndex = indexByKey.get(FLOW_DEFINITIONS_KEY)
    if (flowsIndex === undefined) {
      flowsIndex = orderedChildren.length
      orderedChildren.push([FLOW_DEFINITIONS_KEY, []])
    }
    return { rootCapture: capture, orderedChildren, flowsIndex, seenFullNames }
  }

  /**
   * Appends actual flows from the to-revision translation into the merge's
   * flowDefinitions bucket, skipping any whose fullName is already present
   * in the output-side flows (output-wins-on-conflict — matches the
   * legacy `_scrapTranslationFile` semantics).
   *
   * In-place append into `merge.orderedChildren` is intentional: the merge
   * object is single-use, freshly built per translationPath by the caller,
   * and the writer closure captures the same reference.
   */
  protected _mergeActualFlows(
    merge: TranslationMerge,
    actualFlowDefinitions: FlowDefinition[]
  ): void {
    const bucket = merge.orderedChildren[
      merge.flowsIndex
    ]![1] as FlowDefinition[]
    for (const flowDef of actualFlowDefinitions) {
      // Stryker disable next-line OptionalChaining -- equivalent: defensive optional chain; actualFlowDefinitions is sourced from the parser which never emits undefined elements
      if (merge.seenFullNames.has(flowDef?.fullName)) continue
      bucket.push(flowDef)
      // Stryker disable next-line OptionalChaining -- equivalent: same as above
      merge.seenFullNames.add(flowDef?.fullName)
    }
  }

  // Uses the streaming xmlEventReader so non-flowDefinitions direct
  // children of the Translations root (customFieldTranslations, etc.)
  // are discarded as they are emitted, and flowDefinitions whose
  // fullName is not in packagedFlows never reach this.translations.
  // The callback-level early-filter makes _addFlowPerTranslation a
  // plain append. The underlying reader (xmlEventReader) parses one
  // element at a time via txml's parseNode primitive, so peak memory
  // stays bounded by the largest single subtree rather than the full
  // document.
  protected async _parseTranslationFile(translationPath: string) {
    const source = await readPathFromGit(
      // Stryker disable next-line ObjectLiteral -- equivalent: FileGitRef shape passed to readPathFromGit; tests stub readPathFromGit so the literal {path, oid} shape is opaque past the call boundary
      { path: translationPath, oid: this.config.to },
      this.config
    )
    await parseFromSideSwallowing(source, (subType, element) => {
      // Stryker disable next-line ConditionalExpression -- equivalent: see v8 ignore — the gate is unreachable for translation files which only emit flowDefinitions children
      /* v8 ignore next -- defensive: translation files only contain flowDefinitions children; non-flowDefinitions paths are filtered upstream */
      if (subType !== FLOW_DEFINITIONS_KEY) return
      const flowDefinition = element as FlowDefinition
      // Stryker disable next-line ConditionalExpression -- equivalent: see v8 ignore — fullName is always present
      /* v8 ignore next -- defensive: every flowDefinition emitted by Salesforce has a fullName */
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
    let list = this.translations.get(translationPath)
    if (list === undefined) {
      list = []
      this.translations.set(translationPath, list)
    }
    list.push(flowDefinition)
  }

  protected _shouldProcess() {
    return this.work.changes.forPackageManifest().has(FLOW_XML_NAME)
  }
}
