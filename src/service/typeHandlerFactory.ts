'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { Metadata } from '../types/metadata.js'
import type { Work } from '../types/work.js'

import Bot from './botHandler.js'
import ContainedDecomposed from './containedDecomposedHandler.js'
import CustomFieldHandler from './customFieldHandler.js'
import CustomLabel from './customLabelHandler.js'
import CustomObject from './customObjectHandler.js'
import Decomposed from './decomposedHandler.js'
import FlowHandler from './flowHandler.js'
import InBundle from './inBundleHandler.js'
import InFile from './inFileHandler.js'
import InFolder from './inFolderHandler.js'
import InResource from './inResourceHandler.js'
import Lwc from './lwcHandler.js'
import ObjectTranslation from './objectTranslationHandler.js'
import SharedFolder from './sharedFolderHandler.js'
import Standard from './standardHandler.js'

const handlerMap = {
  AssignmentRules: InFile,
  AuraDefinitionBundle: Lwc,
  AutoResponseRules: InFile,
  BusinessProcess: Decomposed,
  CompactLayout: Decomposed,
  CustomField: CustomFieldHandler,
  CustomFieldTranslation: ObjectTranslation,
  CustomLabel: CustomLabel,
  CustomObject: CustomObject,
  CustomObjectTranslation: ObjectTranslation,
  Dashboard: InFolder,
  DigitalExperienceBundle: InBundle,
  Document: InFolder,
  EmailTemplate: InFolder,
  EscalationRules: InFile,
  ExperienceBundle: InResource,
  FieldSet: Decomposed,
  Flow: FlowHandler,
  GenAiFunction: Lwc,
  GlobalValueSetTranslation: InFile,
  Index: Decomposed,
  LightningComponentBundle: Lwc,
  ListView: Decomposed,
  MarketingAppExtension: InFile,
  MatchingRules: InFile,
  PermissionSet: ContainedDecomposed,
  Profile: InFile,
  RecordType: Decomposed,
  Report: InFolder,
  SharingCriteriaRule: Decomposed,
  SharingGuestRule: Decomposed,
  SharingOwnerRule: Decomposed,
  SharingReason: Decomposed,
  SharingRules: InFile,
  StandardValueSetTranslation: InFile,
  StaticResource: InResource,
  Territory2: Decomposed,
  Territory2Model: CustomObject,
  Territory2Rule: Decomposed,
  Translations: InFile,
  ValidationRule: Decomposed,
  VirtualBot: Bot,
  VirtualDiscovery: SharedFolder,
  VirtualModeration: SharedFolder,
  VirtualWave: SharedFolder,
  WaveTemplateBundle: InResource,
  WebLink: Decomposed,
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
  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {}

  public getTypeHandler(line: string) {
    const type: Metadata = this.metadata.get(line)!
    const xmlName = type.xmlName as keyof typeof handlerMap
    return xmlName in handlerMap
      ? new handlerMap[xmlName](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
