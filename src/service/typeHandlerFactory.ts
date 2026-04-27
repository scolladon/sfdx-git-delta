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

  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {
    const gitAdapter = GitAdapter.getInstance(work.config)
    this.resolver = new MetadataBoundaryResolver(metadata, gitAdapter)
    this.inFileParentXmlNames = new Set()
    this.buildInFileParentIndex()
  }

  @log
  public async getTypeHandler(line: string) {
    const changeType = line.charAt(0)
    const path = line.replace(GIT_DIFF_TYPE_REGEX, '')
    const type = this.metadata.get(path)
    /* v8 ignore next 3 -- upstream RepoGitDiff pre-filters with metadata.has() */
    if (!type) {
      throw new Error(`Unknown metadata type for path: ${path}`)
    }
    const revision =
      changeType === DELETION ? this.work.config.from : this.work.config.to
    const element = await this.resolver.createElement(path, type, revision)
    const Handler = this.resolveHandler(type)
    return new Handler(changeType, element, this.work)
  }

  private buildInFileParentIndex(): void {
    for (const m of this.metadata.values()) {
      if (m.xmlTag && m.key && m.parentXmlName) {
        const parent = this.metadata.getByXmlName(m.parentXmlName)
        if (parent && !parent.adapter) {
          this.inFileParentXmlNames.add(m.parentXmlName)
        }
      }
    }
  }

  private resolveHandler(type: Metadata): typeof Standard {
    const cached = this.handlerCache.get(type)
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

    if (type.parentXmlName) {
      const parent = this.metadata.getByXmlName(type.parentXmlName)
      if (type.xmlTag && type.key && !parent?.adapter) {
        return Decomposed
      }
      if (!type.xmlTag && parent?.decomposition === FOLDER_PER_TYPE) {
        return CustomObjectChildHandler
      }
    }

    if (this.inFileParentXmlNames.has(xmlName)) {
      return InFile
    }

    return Standard
  }
}
