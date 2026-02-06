'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
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

const handlerMap = {
  AssignmentRules: InFile,
  AuraDefinitionBundle: Lwc,
  AutoResponseRules: InFile,
  BusinessProcess: CustomObjectChildHandler,
  CompactLayout: CustomObjectChildHandler,
  CustomField: CustomFieldHandler,
  CustomFieldTranslation: ObjectTranslation,
  CustomLabel: CustomLabel,
  CustomObject: CustomObject,
  CustomObjectTranslation: ObjectTranslation,
  Dashboard: ReportingFolderHandler,
  DigitalExperienceBundle: InBundle,
  Document: InFolder,
  EmailTemplate: InFolder,
  EscalationRules: InFile,
  ExperienceBundle: InResource,
  FieldSet: CustomObjectChildHandler,
  Flow: FlowHandler,
  GenAiFunction: Lwc,
  GenAiPlannerBundle: InResource,
  GlobalValueSetTranslation: InFile,
  Index: CustomObjectChildHandler,
  LightningComponentBundle: Lwc,
  LightningTypeBundle: InResource,
  ListView: CustomObjectChildHandler,
  MarketingAppExtension: InFile,
  MatchingRules: InFile,
  PermissionSet: ContainedDecomposed,
  Profile: InFile,
  RecordType: CustomObjectChildHandler,
  Report: ReportingFolderHandler,
  SharingCriteriaRule: Decomposed,
  SharingGuestRule: Decomposed,
  SharingOwnerRule: Decomposed,
  SharingReason: CustomObjectChildHandler,
  SharingRules: InFile,
  StandardValueSetTranslation: InFile,
  StaticResource: InResource,
  Territory2: Decomposed,
  Territory2Model: CustomObject,
  Territory2Rule: Decomposed,
  Translations: InFile,
  ValidationRule: CustomObjectChildHandler,
  VirtualBot: Bot,
  VirtualDiscovery: SharedFolder,
  VirtualModeration: SharedFolder,
  VirtualWave: SharedFolder,
  WaveTemplateBundle: InResource,
  WebLink: CustomObjectChildHandler,
  Workflow: InFile,
  WorkflowAlert: Decomposed,
  WorkflowFieldUpdate: Decomposed,
  WorkflowFlowAction: Decomposed,
  WorkflowKnowledgePublish: Decomposed,
  WorkflowOutboundMessage: Decomposed,
  WorkflowRule: Decomposed,
  WorkflowSend: Decomposed,
  WorkflowTask: Decomposed,
}

export default class TypeHandlerFactory {
  protected readonly resolver: MetadataBoundaryResolver

  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {
    const gitAdapter = GitAdapter.getInstance(work.config)
    this.resolver = new MetadataBoundaryResolver(metadata, gitAdapter)
  }

  @log
  public getTypeHandler(line: string) {
    const type: Metadata = this.metadata.get(line)!
    const xmlName = type.xmlName as keyof typeof handlerMap
    return xmlName in handlerMap
      ? new handlerMap[xmlName](
          line,
          type,
          this.work,
          this.metadata,
          this.resolver
        )
      : new Standard(line, type, this.work, this.metadata, this.resolver)
  }
}
