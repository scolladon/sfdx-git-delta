'use strict'
const CustomObject = require('./customObjectHandler')
const InFile = require('./inFileHandler')
const InFolder = require('./inFolderHandler')
const InResource = require('./inResourceHandler')
const Standard = require('./standardHandler')
const SubCustomObject = require('./subCustomObjectHandler')
const InTranslation = require('./inTranslationHandler')
const Wave = require('./waveHandler')

const path = require('path')

const classes = {
  aura: InResource,
  bot: InFile,
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

const EMPTY_STRING = ''
const haveSubTypes = [CustomObject.OBJECT_TYPE, EMPTY_STRING]

module.exports = class HandlerFactory {
  constructor(work, metadata) {
    this.work = work
    this.metadata = metadata
  }

  getTypeHandler(line) {
    const type = line.split(path.sep).reduce((acc, value, _, arr) => {
      acc = Object.prototype.hasOwnProperty.call(this.metadata, value)
        ? value
        : acc
      if (!haveSubTypes.includes(acc)) arr.splice(1)
      return acc
    }, EMPTY_STRING)

    return classes[type]
      ? new classes[type](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
