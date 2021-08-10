import { MetadataRepository } from '../model/Metadata'
import { Result } from '../model/Result'

import CustomObject from './customObjectHandler'
import InFile from './inFileHandler'
import InFolder from './inFolderHandler'
import InResource from './inResourceHandler'
import Standard from './standardHandler'
import SubCustomObject from './subCustomObjectHandler'
import InTranslation from './inTranslationHandler'
import Wave from './waveHandler'

import { sep } from 'path'

type HandlerMap = {
  [key: string]: typeof Standard
}

const handlerMap: HandlerMap = {
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

export default class HandlerFactory {
  metadata: MetadataRepository
  work: Result
  constructor(work: Result, metadata: MetadataRepository) {
    this.work = work
    this.metadata = metadata
  }

  getTypeHandler(line: string) {
    const type = line
      .split(sep)
      .reduce((acc: string, value: string, _: number, arr: Array<string>) => {
        acc = Object.prototype.hasOwnProperty.call(this.metadata, value)
          ? value
          : acc
        if (!haveSubTypes.includes(acc)) arr.splice(1)
        return acc
      }, '')

    return handlerMap[type]
      ? new handlerMap[type](line, type, this.work, this.metadata)
      : new Standard(line, type, this.work, this.metadata)
  }
}
