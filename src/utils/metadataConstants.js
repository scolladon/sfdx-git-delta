'use strict'
const { MINUS, PLUS } = require('../utils/gitConstants')

const FIELD_DIRECTORY_NAME = 'fields'
const FLOW_DIRECTORY_NAME = 'flows'
const FULLNAME = 'fullName'
const FULLNAME_XML_TAG = new RegExp(`<${FULLNAME}>(.*)</${FULLNAME}>`)
const INFOLDER_SUFFIX = `Folder`
const LABEL_EXTENSION = 'labels'
const LABEL_XML_NAME = 'CustomLabel'
const MASTER_DETAIL_TAG = '<type>MasterDetail</type>'
const METAFILE_SUFFIX = '-meta.xml'
const META_REGEX = new RegExp(`${METAFILE_SUFFIX}$`)
const OBJECT_META_XML_SUFFIX = `object${METAFILE_SUFFIX}`
const OBJECT_TRANSLATION_TYPE = 'objectTranslations'
const OBJECT_TRANSLATION_META_XML_SUFFIX = `objectTranslation${METAFILE_SUFFIX}`
const OBJECT_TYPE = 'objects'
const OBJECT_XML_NAME = 'CustomObject'
const SUB_OBJECT_TYPES = [
  'businessProcesses',
  'compactLayouts',
  'fieldSets',
  'fields',
  'indexes',
  'listViews',
  'recordTypes',
  'rules',
  'sharingReasons',
  'territories',
  'validationRules',
  'webLinks',
]
const TERRITORY_MODEL_TYPE = 'territory2Models'
const TRANSLATION_EXTENSION = 'translation'
const TRANSLATION_TYPE = 'translations'
const XML_TAG = new RegExp(`^[${MINUS}${PLUS}]?\\s*<([^(/><.)]+)>\\s*$`)
const XML_HEADER_TAG_END = '?>'

module.exports.FIELD_DIRECTORY_NAME = FIELD_DIRECTORY_NAME
module.exports.FLOW_DIRECTORY_NAME = FLOW_DIRECTORY_NAME
module.exports.FULLNAME = FULLNAME
module.exports.FULLNAME_XML_TAG = FULLNAME_XML_TAG
module.exports.INFOLDER_SUFFIX = INFOLDER_SUFFIX
module.exports.LABEL_EXTENSION = LABEL_EXTENSION
module.exports.LABEL_XML_NAME = LABEL_XML_NAME
module.exports.MASTER_DETAIL_TAG = MASTER_DETAIL_TAG
module.exports.METAFILE_SUFFIX = METAFILE_SUFFIX
module.exports.META_REGEX = META_REGEX
module.exports.OBJECT_META_XML_SUFFIX = OBJECT_META_XML_SUFFIX
module.exports.OBJECT_TRANSLATION_META_XML_SUFFIX =
  OBJECT_TRANSLATION_META_XML_SUFFIX
module.exports.OBJECT_TRANSLATION_TYPE = OBJECT_TRANSLATION_TYPE
module.exports.OBJECT_TYPE = OBJECT_TYPE
module.exports.OBJECT_XML_NAME = OBJECT_XML_NAME
module.exports.SUB_OBJECT_TYPES = SUB_OBJECT_TYPES
module.exports.TERRITORY_MODEL_TYPE = TERRITORY_MODEL_TYPE
module.exports.TRANSLATION_EXTENSION = TRANSLATION_EXTENSION
module.exports.TRANSLATION_TYPE = TRANSLATION_TYPE
module.exports.XML_TAG = XML_TAG
module.exports.XML_HEADER_TAG_END = XML_HEADER_TAG_END
