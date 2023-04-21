'use strict'
const Bot = require('./botHandler')
const CustomObject = require('./customObjectHandler')
const InBundleHandler = require('./inBundleHandler')
const InFile = require('./inFileHandler')
const InFolder = require('./inFolderHandler')
const InResource = require('./inResourceHandler')
const LwcHandler = require('./lwcHandler')
const Standard = require('./standardHandler')
const SubCustomObject = require('./subCustomObjectHandler')
const ObjectTranslation = require('./ObjectTranslationHandler')
const Wave = require('./waveHandler')

const { getType } = require('../utils/typeUtils')

const classes = {
  assignmentRules: InFile,
  autoResponseRules: InFile,
  aura: LwcHandler,
  bots: Bot,
  businessProcesses: SubCustomObject,
  compactLayouts: SubCustomObject,
  dashboards: InFolder,
  digitalExperiences: InBundleHandler,
  discovery: Wave,
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
  wave: Wave,
  waveTemplates: InResource,
  webLinks: SubCustomObject,
  workflows: InFile,
}

module.exports = class HandlerFactory {
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
