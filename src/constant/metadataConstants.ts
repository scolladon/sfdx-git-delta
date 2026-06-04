'use strict'
// SDR adapters whose component is a directory owning an opaque content subtree
// (StaticResource/ExperienceBundle/Document via mixedContent, Aura/LWC via
// bundle, DigitalExperienceBundle via digitalExperience). When such a type is
// matched while resolving a path, deeper segments are user-named content — not
// metadata directories — so type resolution must stop there.
export const CONTENT_CONTAINER_ADAPTERS = new Set([
  'bundle',
  'digitalExperience',
  'mixedContent',
])
export const CUSTOM_APPLICATION_SUFFIX = 'app'
export const CUSTOM_METADATA_SUFFIX = 'md'
export const DIGITAL_EXPERIENCE_BUNDLE_TYPE = 'DigitalExperienceBundle'
export const DIGITAL_EXPERIENCE_TYPE = 'DigitalExperience'
export const EMAIL_SERVICES_FUNCTION_SUFFIX = 'xml'
export const FIELD_DIRECTORY_NAME = 'fields'
export const FLOW_XML_NAME = 'Flow'
export const INFOLDER_SUFFIX = `Folder`
export const LABEL_DECOMPOSED_SUFFIX = 'label'
export const MASTER_DETAIL_TAG = '<type>MasterDetail</type>'
export const METAFILE_SUFFIX = '-meta.xml'
export const META_REGEX = new RegExp(`${METAFILE_SUFFIX}$`)
export const OBJECT_TRANSLATION_META_XML_SUFFIX = `objectTranslation${METAFILE_SUFFIX}`
export const OBJECT_TRANSLATION_TYPE = 'CustomObjectTranslation'
export const OBJECT_TYPE = 'CustomObject'
export const PERMISSIONSET_TYPE = 'PermissionSet'
export const SHARING_RULE_TYPE = 'SharingRules'
export const SUB_OBJECT_TYPES = [
  'BusinessProcess',
  'CompactLayout',
  'CustomField',
  'FieldSet',
  'Index',
  'ListView',
  'RecordType',
  'SharingCriteriaRule',
  'SharingGuestRule',
  'SharingOwnerRule',
  'SharingReason',
  'Territory2',
  'Territory2Rule',
  'ValidationRule',
  'WebLink',
  'WorkflowAlert',
  'WorkflowFieldUpdate',
  'WorkflowFlowAction',
  'WorkflowKnowledgePublish',
  'WorkflowOutboundMessage',
  'WorkflowRule',
  'WorkflowSend',
  'WorkflowTask',
]
export const TRANSLATION_EXTENSION = 'translation'
export const TRANSLATION_TYPE = 'Translations'
export const WORKFLOW_TYPE = 'Workflow'
