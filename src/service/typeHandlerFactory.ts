'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { Metadata } from '../types/metadata'
import type { Work } from '../types/work'

import Bot from './botHandler'
import CustomObject from './customObjectHandler'
import Decomposed from './decomposedHandler'
import HangingDecomposed from './hangingDecomposedHandler'
import InBundle from './inBundleHandler'
import InFile from './inFileHandler'
import InFolder from './inFolderHandler'
import InResource from './inResourceHandler'
import Lwc from './lwcHandler'
import ObjectTranslation from './objectTranslationHandler'
import SharedFolder from './sharedFolderHandler'
import Standard from './standardHandler'

const handlerMap = {
  AssignmentRules: InFile,
  AuraDefinitionBundle: Lwc,
  AutoResponseRules: InFile,
  BusinessProcess: Decomposed,
  CompactLayout: Decomposed,
  CustomField: Decomposed,
  CustomFieldTranslation: ObjectTranslation,
  CustomLabel: InFile,
  CustomObject: CustomObject,
  CustomObjectTranslation: ObjectTranslation,
  Dashboard: InFolder,
  DigitalExperienceBundle: InBundle,
  Document: InFolder,
  EmailTemplate: InFolder,
  EscalationRules: InFile,
  ExperienceBundle: InResource,
  FieldSet: Decomposed,
  GlobalValueSetTranslation: InFile,
  Index: Decomposed,
  LightningComponentBundle: Lwc,
  ListView: Decomposed,
  MarketingAppExtension: InFile,
  MatchingRules: InFile,
  PermissionSet: HangingDecomposed,
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
  WorkflowKnowledgePublish: Decomposed,
  WorkflowOutboundMessage: Decomposed,
  WorkflowRule: Decomposed,
  WorkflowSend: Decomposed,
  WorkflowTask: Decomposed,
}

export default class TypeHandlerFactory {
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly work: Work,
    // eslint-disable-next-line no-unused-vars
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
