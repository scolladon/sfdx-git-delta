'use strict'
import Bot from './botHandler'
import CustomObject from './customObjectHandler'
import InBundleHandler from './inBundleHandler'
import InFile from './inFileHandler'
import InFolder from './inFolderHandler'
import InResource from './inResourceHandler'
import LwcHandler from './lwcHandler'
import Standard from './standardHandler'
import SubCustomObject from './subCustomObjectHandler'
import ObjectTranslation from './objectTranslationHandler'
import SharedFolder from './sharedFolderHandler'

import { getType } from '../utils/typeUtils'

const classes = {
  assignmentRules: InFile,
  autoResponseRules: InFile,
  aura: LwcHandler,
  bots: Bot,
  businessProcesses: SubCustomObject,
  compactLayouts: SubCustomObject,
  dashboards: InFolder,
  digitalExperiences: InBundleHandler,
  discovery: SharedFolder,
  documents: InFolder,
  email: InFolder,
  escalationRules: InFile,
  experiences: InResource,
  fieldSets: SubCustomObject,
  fields: SubCustomObject,
  globalValueSetTranslations: InFile,
  indexes: SubCustomObject,
  labels: InFile,
  listViews: SubCustomObject,
  lwc: LwcHandler,
  matchingRules: InFile,
  moderation: SharedFolder,
  objects: CustomObject,
  objectTranslations: ObjectTranslation,
  profiles: InFile,
  recordTypes: SubCustomObject,
  reports: InFolder,
  rules: SubCustomObject,
  sharingReasons: SubCustomObject,
  sharingRules: InFile,
  standardValueSetTranslations: InFile,
  staticresources: InResource,
  territories: SubCustomObject,
  territory2Models: CustomObject,
  translations: InFile,
  validationRules: SubCustomObject,
  wave: SharedFolder,
  waveTemplates: InResource,
  webLinks: SubCustomObject,
  workflows: InFile,
}

export default class TypeHandlerFactory {
  work
  metadata

  constructor(work, metadata) {
    this.work = work
    this.metadata = metadata
  }

  getTypeHandler(line) {
    const type = getType(line, this.metadata)

    return classes[type]
      ? new classes[type](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
