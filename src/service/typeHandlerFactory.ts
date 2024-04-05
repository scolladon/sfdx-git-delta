'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository'
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
  assignmentRules: InFile,
  autoResponseRules: InFile,
  aura: Lwc,
  bots: Bot,
  businessProcesses: Decomposed,
  compactLayouts: Decomposed,
  dashboards: InFolder,
  digitalExperiences: InBundle,
  discovery: SharedFolder,
  documents: InFolder,
  email: InFolder,
  escalationRules: InFile,
  experiences: InResource,
  fieldSets: Decomposed,
  fields: Decomposed,
  globalValueSetTranslations: InFile,
  indexes: Decomposed,
  labels: InFile,
  listViews: Decomposed,
  lwc: Lwc,
  marketingappextensions: InFile,
  matchingRules: InFile,
  moderation: SharedFolder,
  objects: CustomObject,
  objectTranslations: ObjectTranslation,
  permissionsets: HangingDecomposed,
  profiles: InFile,
  recordTypes: Decomposed,
  reports: InFolder,
  rules: Decomposed,
  sharingReasons: Decomposed,
  sharingRules: InFile,
  standardValueSetTranslations: InFile,
  staticresources: InResource,
  territories: Decomposed,
  territory2Models: CustomObject,
  translations: InFile,
  validationRules: Decomposed,
  wave: SharedFolder,
  waveTemplates: InResource,
  webLinks: Decomposed,
  workflows: InFile,
}

export default class TypeHandlerFactory {
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly work: Work,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {}

  public getTypeHandler(line: string) {
    const type = this.metadata.get(line)
      ?.directoryName as keyof typeof handlerMap

    return type in handlerMap
      ? new handlerMap[type](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
