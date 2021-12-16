'use strict'
const CustomObject = require('./customObjectHandler')
const InFile = require('./inFileHandler')
const InFolder = require('./inFolderHandler')
const InResource = require('./inResourceHandler')
const Standard = require('./standardHandler')
const SubCustomObject = require('./subCustomObjectHandler')
const InTranslation = require('./inTranslationHandler')
const Wave = require('./waveHandler')

const typeUtils = require('../utils/typeUtils')

const classes = {
  aura: InResource,
  bot: InFile,
  businessProcesses: SubCustomObject,
  compactLayouts: SubCustomObject,
  dashboards: InFolder,
  discovery: Wave,
  documents: InFolder,
  email: InFolder,
  experiences: InResource,
  fieldSets: SubCustomObject,
  fields: SubCustomObject,
  labels: InFile,
  listViews: SubCustomObject,
  lwc: InResource,
  objects: CustomObject,
  objectTranslations: InTranslation,
  recordTypes: SubCustomObject,
  reports: InFolder,
  rules: SubCustomObject,
  sharingReasons: SubCustomObject,
  sharingRules: InFile,
  staticresources: InResource,
  territories: SubCustomObject,
  territory2Models: CustomObject,
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
    const type = typeUtils.getType(line, this.metadata)

    return classes[type]
      ? new classes[type](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
