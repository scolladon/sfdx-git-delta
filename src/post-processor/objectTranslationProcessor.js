'use strict'
const BaseProcessor = require('./baseProcessor')
const {
  OBJECT_TRANSLATION_TYPE,
  OBJECT_TRANSLATION_META_XML_SUFFIX,
} = require('../utils/metadataConstants')

const ScopeHelper = require('./helpers/scopeHelper')

const metadataMapping = {
  fields: { xmlTag: 'CustomField', key: 'name', parentLink: true },
  fieldSets: { xmlTag: 'FieldSet', key: 'name', parentLink: true },
  layouts: { xmlTag: 'Layout', key: 'layout', parentLink: true },
  quickActions: { xmlTag: 'QuickAction', key: 'name', parentLink: true },
  recordTypes: { xmlTag: 'RecordType', key: 'name', parentLink: true },
  sharingReasons: { xmlTag: 'SharingReason', key: 'name', parentLink: true },
  validationRules: { xmlTag: 'ValidationRule', key: 'name', parentLink: true },
  webLinks: { xmlTag: 'WebLink', key: 'name', parentLink: true },
  workflowTasks: { xmlTag: 'WorkflowTask', key: 'name', parentLink: true },
}

const entryXmlAttribut = 'CustomObjectTranslation'
const metadataType = OBJECT_TRANSLATION_TYPE
const metadataFileSuffix = `${OBJECT_TRANSLATION_META_XML_SUFFIX}`
class ObjectTranslationProcessor extends BaseProcessor {
  async process() {
    if (!this.config.generateDelta || !this.config.scopeTranslations) {
      return
    }
    const helper = new ScopeHelper({
      entryXmlAttribut,
      metadataMapping,
      metadataType,
      metadataFileSuffix,
      context: this.work,
    })

    await helper.scope()
  }
}

module.exports = ObjectTranslationProcessor
