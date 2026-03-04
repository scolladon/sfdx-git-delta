'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { PATH_SEP } from '../constant/fsConstants.js'
import { DELETION, GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { Metadata } from '../types/metadata.js'
import type { Work } from '../types/work.js'
import { log } from '../utils/LoggingDecorator.js'
import { MetadataBoundaryResolver } from '../utils/metadataBoundaryResolver.js'

import Bot from './botHandler.js'
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
import PermissionSetChildHandler from './permissionSetChildHandler.js'
import ReportingFolderHandler from './reportingFolderHandler.js'
import SharedFolder from './sharedFolderHandler.js'
import Standard from './standardHandler.js'

const FOLDER_PER_TYPE = 'folderPerType'
const CONTAINED_DECOMPOSED = 'containedDecomposed'

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
  private readonly metadataByXmlName: Map<string, Metadata>
  private readonly inFileParentXmlNames: Set<string>

  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {
    const gitAdapter = GitAdapter.getInstance(work.config)
    this.resolver = new MetadataBoundaryResolver(metadata, gitAdapter)
    this.metadataByXmlName = new Map()
    this.inFileParentXmlNames = new Set()
    this.buildIndex()
  }

  @log
  public async getTypeHandler(line: string) {
    const changeType = line.charAt(0)
    const path = line.replace(GIT_DIFF_TYPE_REGEX, '')
    const type: Metadata = this.metadata.get(path)!
    const revision =
      changeType === DELETION ? this.work.config.from : this.work.config.to
    const element = await this.resolver.createElement(path, type, revision)
    const Handler = this.resolveHandler(type, path.split(PATH_SEP))
    return new Handler(changeType, element, this.work)
  }

  private buildIndex(): void {
    for (const m of this.metadata.values()) {
      this.metadataByXmlName.set(m.xmlName!, m)
    }
    for (const m of this.metadata.values()) {
      if (m.xmlTag && m.key && m.parentXmlName) {
        const parent = this.metadataByXmlName.get(m.parentXmlName)
        if (parent && !parent.adapter) {
          this.inFileParentXmlNames.add(m.parentXmlName)
        }
      }
    }
  }

  private resolveHandler(type: Metadata, parts: string[]): typeof Standard {
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
      const parent = this.metadataByXmlName.get(type.parentXmlName)
      if (type.xmlTag && type.key && !parent?.adapter) {
        return Decomposed
      }
      if (!type.xmlTag && parent?.decomposition === FOLDER_PER_TYPE) {
        return CustomObjectChildHandler
      }
      if (!type.xmlTag && parent?.decomposition === CONTAINED_DECOMPOSED) {
        return PermissionSetChildHandler
      }
    }

    if (this.inFileParentXmlNames.has(xmlName)) {
      return InFile
    }

    // Standalone type under a decomposed parent directory
    // (e.g., CustomPermission under permissionsets/)
    const psType = this.metadataByXmlName.get('PermissionSet')
    if (
      psType?.decomposition === CONTAINED_DECOMPOSED &&
      psType.directoryName &&
      parts.includes(psType.directoryName)
    ) {
      return PermissionSetChildHandler
    }

    return Standard
  }
}
