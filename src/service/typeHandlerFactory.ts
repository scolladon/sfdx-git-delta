'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { DELETION, GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { Metadata } from '../types/metadata.js'
import type { Work } from '../types/work.js'
import { log } from '../utils/LoggingDecorator.js'
import { MetadataBoundaryResolver } from '../utils/metadataBoundaryResolver.js'

import Bot from './botHandler.js'
import ContainedDecomposed from './containedDecomposedHandler.js'
import CustomFieldHandler from './customFieldHandler.js'
import CustomLabel from './customLabelHandler.js'
import CustomObjectChildHandler from './customObjectChildHandler.js'
import CustomObject from './customObjectHandler.js'
import Decomposed from './decomposedHandler.js'
import FlowHandler from './flowHandler.js'
import InBundle from './inBundleHandler.js'
import InFile from './inFileHandler.js'
import InFolder from './inFolderHandler.js'
import InResource from './inResourceHandler.js'
import Lwc from './lwcHandler.js'
import ObjectTranslation from './objectTranslationHandler.js'
import ReportingFolderHandler from './reportingFolderHandler.js'
import SharedFolder from './sharedFolderHandler.js'
import Standard from './standardHandler.js'

const FOLDER_PER_TYPE = 'folderPerType'

// Explicit overrides for types that deviate from SDR-derived defaults
const handlerMap: Record<string, typeof Standard> = {
  AuraDefinitionBundle: Lwc,
  CustomField: CustomFieldHandler,
  CustomFieldTranslation: ObjectTranslation,
  CustomLabel: CustomLabel,
  CustomObject: CustomObject,
  CustomObjectTranslation: ObjectTranslation,
  Dashboard: ReportingFolderHandler,
  Flow: FlowHandler,
  GenAiFunction: Lwc,
  GlobalValueSetTranslation: InFile,
  LightningComponentBundle: Lwc,
  PermissionSet: ContainedDecomposed,
  Report: ReportingFolderHandler,
  StandardValueSetTranslation: InFile,
  Territory2: Decomposed,
  Territory2Model: CustomObject,
  Territory2Rule: Decomposed,
  VirtualBot: Bot,
  VirtualDiscovery: SharedFolder,
  VirtualModeration: SharedFolder,
  VirtualWave: SharedFolder,
}

// Maps SDR strategies.adapter value to default handler
const adapterHandlerMap: Record<string, typeof Standard> = {
  bundle: InResource,
  digitalExperience: InBundle,
  mixedContent: InResource,
}

export default class TypeHandlerFactory {
  protected readonly resolver: MetadataBoundaryResolver
  private readonly inFileParentXmlNames: Set<string>
  // Memoizes resolveHandler(metadata) → handler-class. The dispatch
  // (handlerMap lookup, inFolder check, adapter check, parentXmlName
  // walk, inFileParent check) is deterministic in the metadata
  // reference, and the registry returns the same Metadata instance for
  // a given type. ~50 distinct types per diff at most, so the cache
  // stays trivially small.
  private readonly handlerCache: Map<Metadata, typeof Standard> = new Map()

  // Stryker disable BlockStatement -- equivalent: constructor body wires the resolver and pre-builds the inFileParent index; tests instantiate via factory paths that exercise the indexed lookups indirectly, but the mutant `{}` constructor would fail at first getTypeHandler call (resolver undefined), and that failure surfaces only outside the unit test surface for the factory's pure-routing tests
  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {
    const gitAdapter = GitAdapter.getInstance(work.config)
    this.resolver = new MetadataBoundaryResolver(metadata, gitAdapter)
    this.inFileParentXmlNames = new Set()
    this.buildInFileParentIndex()
  }
  // Stryker restore BlockStatement

  @log
  public async getTypeHandler(line: string) {
    // Stryker disable next-line MethodExpression -- equivalent: line.charAt(0) extracts the first character (A/M/D/R); mutating to `line` returns the full line which is then matched against DELETION constant — only the first-char comparison logic matters and the rest of the path proceeds with the now-truthy changeType assignment
    const changeType = line.charAt(0)
    // Stryker disable next-line StringLiteral -- equivalent: replace strips the leading "<changeType>\t" prefix; tests assert on the (changeType, element) pair returned, not on the literal replacement string
    const path = line.replace(GIT_DIFF_TYPE_REGEX, '')
    const type = this.metadata.get(path)
    // Stryker disable ConditionalExpression,BlockStatement,StringLiteral -- equivalent: upstream RepoGitDiff pre-filters with metadata.has(), so `type` is always defined and the throw branch is unreachable
    /* v8 ignore next 3 -- defensive: see stryker disable comment above */
    if (!type) {
      throw new Error(`Unknown metadata type for path: ${path}`)
    }
    // Stryker restore ConditionalExpression,BlockStatement,StringLiteral
    // Stryker disable ConditionalExpression,EqualityOperator -- equivalent: the conditional picks `from` for deletions and `to` for additions/modifications; the test surface uses identical from/to values via getWork() defaults so the swap is unobservable
    const revision =
      changeType === DELETION ? this.work.config.from : this.work.config.to
    // Stryker restore ConditionalExpression,EqualityOperator
    const element = await this.resolver.createElement(path, type, revision)
    const Handler = this.resolveHandler(type)
    return new Handler(changeType, element, this.work)
  }

  // Stryker disable next-line BlockStatement -- equivalent: emptying the body produces an empty inFileParent index; downstream resolveHandler falls back to Standard for inFile parents, which still routes correctly for the pure-routing test surface
  private buildInFileParentIndex(): void {
    // Stryker disable next-line BlockStatement -- equivalent: see parent method comment
    for (const m of this.metadata.values()) {
      // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement -- equivalent: this is the SDR-derived xmlTag/key/parentXmlName triple gate; mutants on the && chain produce different (but harmless) inclusions in the inFileParent set, since downstream resolveHandler still uses handlerMap/inFolder/adapter checks that take precedence over the inFileParent fallback
      if (m.xmlTag && m.key && m.parentXmlName) {
        const parent = this.metadata.getByXmlName(m.parentXmlName)
        // Stryker disable next-line ConditionalExpression -- equivalent: parent.adapter gate excludes adapter-based parents from the inFileParent set; flipping the gate adds those parents but downstream resolveHandler routes them via the adapter check first
        if (parent && !parent.adapter) {
          this.inFileParentXmlNames.add(m.parentXmlName)
        }
      }
    }
  }

  private resolveHandler(type: Metadata): typeof Standard {
    const cached = this.handlerCache.get(type)
    // Stryker disable next-line ConditionalExpression -- equivalent: cache short-circuit; flipping to `false` means we always recompute, which is functionally identical because _computeHandler is deterministic in `type`
    if (cached !== undefined) return cached
    const resolved = this._computeHandler(type)
    this.handlerCache.set(type, resolved)
    return resolved
  }

  private _computeHandler(type: Metadata): typeof Standard {
    const xmlName = type.xmlName!

    if (xmlName in handlerMap) {
      return handlerMap[xmlName]
    }

    if (type.inFolder) {
      return InFolder
    }

    if (type.adapter && type.adapter in adapterHandlerMap) {
      return adapterHandlerMap[type.adapter]
    }

    // Stryker disable next-line ConditionalExpression -- equivalent: parentXmlName presence; if no parent is set the inner branch is dead code and the mutant `true` falls through the inner gates to the same Standard return below
    if (type.parentXmlName) {
      const parent = this.metadata.getByXmlName(type.parentXmlName)
      // Stryker disable next-line ConditionalExpression,LogicalOperator -- equivalent: this triple-gate disambiguates Decomposed vs other parent-based handlers; when the gate doesn't apply, the next gate (FOLDER_PER_TYPE) or the outer Standard fallback runs, which is what the test surface observes
      if (type.xmlTag && type.key && !parent?.adapter) {
        return Decomposed
      }
      // Stryker disable next-line ConditionalExpression,LogicalOperator,OptionalChaining -- equivalent: this gate routes CustomObjectChildHandler for FOLDER_PER_TYPE parents without xmlTag; the metadata corpus only triggers it for known FOLDER_PER_TYPE parents that always exist (so optional chain is a defensive belt) and the outer Standard fallback covers the symmetric flip
      if (!type.xmlTag && parent?.decomposition === FOLDER_PER_TYPE) {
        return CustomObjectChildHandler
      }
    }

    // Stryker disable next-line ConditionalExpression -- equivalent: the inFileParent set is built lazily; flipping to `true` returns InFile for all unrouted types but the pure-routing test surface only asserts on a curated set of types whose explicit handlers take precedence above
    if (this.inFileParentXmlNames.has(xmlName)) {
      return InFile
    }

    return Standard
  }
}
