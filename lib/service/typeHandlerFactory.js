'use strict'
const CustomObject = require('./customObjectHandler')
const InFile = require('./inFileHandler')
const InFolder = require('./inFolderHandler')
const InResource = require('./inResourceHandler')
const Lightning = require('./lightningHandler')
const Standard = require('./standardHandler')
const SubCustomObject = require('./subCustomObjectHandler')
const InTranslation = require('./inTranslationHandler')
const Wave = require('./waveHandler')

const path = require('path')

const classes = {
  aura: Lightning,
  businessProcesses: SubCustomObject,
  compactLayouts: SubCustomObject,
  dashboards: InFolder,
  documents: InFolder,
  email: InFolder,
  experiences: InResource,
  fieldSets: SubCustomObject,
  fields: SubCustomObject,
  labels: InFile,
  listViews: SubCustomObject,
  lwc: Lightning,
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
    const type = line
      .split(path.sep)
      .reduce(
        (acc, value) =>
          Object.prototype.hasOwnProperty.call(this.metadata, value)
            ? value
            : acc,
        ''
      )

    return classes[type]
      ? new classes[type](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
