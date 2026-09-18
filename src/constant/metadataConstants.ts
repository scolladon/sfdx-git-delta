'use strict'
export const BOT_TYPE = 'Bot'
export const BOT_VERSION_TYPE = 'BotVersion'
export const CUSTOM_APPLICATION_SUFFIX = 'app'
export const CUSTOM_METADATA_SUFFIX = 'md'
export const DASHBOARD_TYPE = 'Dashboard'
// A component named by the single segment below its type directory: every
// content-container adapter except digitalExperience (depths below), and the
// holder-scoped composed types, whose every file keys on that one segment.
export const DEFAULT_CONTAINER_DEPTH = 1
export const DIGITAL_EXPERIENCE_ADAPTER = 'digitalExperience'
// SDR adapters whose component is a directory owning an opaque content subtree
// (StaticResource/ExperienceBundle/Document via mixedContent, Aura/LWC via
// bundle, DigitalExperienceBundle via digitalExperience). When such a type is
// matched while resolving a path, deeper segments are user-named content — not
// metadata directories — so type resolution must stop there.
export const CONTENT_CONTAINER_ADAPTERS = new Set([
  'bundle',
  DIGITAL_EXPERIENCE_ADAPTER,
  'mixedContent',
])
export const DIGITAL_EXPERIENCE_BUNDLE_TYPE = 'DigitalExperienceBundle'
// SDR's canonical layout below `digitalExperiences/` is
// `<baseType>/<spaceApiName>/<contentType>/<contentApiName>/<file>`: the
// bundle is the first two segments, a page content folder the first four.
export const DIGITAL_EXPERIENCE_BUNDLE_DEPTH = 2
export const DIGITAL_EXPERIENCE_CONTENT_DEPTH = 4
export const DIGITAL_EXPERIENCE_TYPE = 'DigitalExperience'
export const EMAIL_SERVICES_FUNCTION_SUFFIX = 'xml'
export const FIELD_DIRECTORY_NAME = 'fields'
export const FLOW_DEFINITIONS_KEY = 'flowDefinitions'
export const FLOW_XML_NAME = 'Flow'
export const INFOLDER_SUFFIX = `Folder`
export const INFOLDER_SUFFIX_REGEX = new RegExp(`${INFOLDER_SUFFIX}$`)
export const LABEL_DECOMPOSED_SUFFIX = 'label'
export const MASTER_DETAIL_TAG = '<type>MasterDetail</type>'
export const METAFILE_SUFFIX = '-meta.xml'
export const META_REGEX = new RegExp(`${METAFILE_SUFFIX}$`)
export const OBJECT_TRANSLATION_META_XML_SUFFIX = `objectTranslation${METAFILE_SUFFIX}`
export const OBJECT_TRANSLATION_TYPE = 'CustomObjectTranslation'
export const OBJECT_TYPE = 'CustomObject'
export const PERMISSIONSET_TYPE = 'PermissionSet'
export const RECORD_TYPE = 'RecordType'
export const REPORT_TYPE = 'Report'
// The Metadata API relocates these when the package lists them under a new
// folder, so their former path must not be destroyed alongside the move.
// Declared out of alphabetical order on purpose: the Set dereferences both
// members at module evaluation, so filing it under F would read REPORT_TYPE
// before its initialiser has run.
export const FOLDER_MOVE_ON_DEPLOY_TYPES: ReadonlySet<string> = new Set([
  REPORT_TYPE,
  DASHBOARD_TYPE,
])
export const SHARING_RULE_TYPE = 'SharingRules'
export const SUB_OBJECT_TYPES = [
  'BusinessProcess',
  'CompactLayout',
  'CustomField',
  'FieldSet',
  'Index',
  'ListView',
  RECORD_TYPE,
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
// The Metadata API cannot delete these, so a destructive entry for one is a
// component failure that fails the whole deploy: the destructive view omits
// them and a warning names them instead.
// See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#recordtype-destructive-changes
// Must stay disjoint from FOLDER_MOVE_ON_DEPLOY_TYPES, BOT_TYPE and
// BOT_VERSION_TYPE: undeletableDeletions() reports from the pre-suppressor
// view, so an overlap would let the warning name a member those suppressors
// drop anyway, and the manifest and the warning would disagree.
export const UNDELETABLE_TYPES: ReadonlySet<string> = new Set([RECORD_TYPE])
export const TRANSLATION_EXTENSION = 'translation'
export const TRANSLATION_TYPE = 'Translations'
export const VIRTUAL_BOT_TYPE = 'VirtualBot'
export const WORKFLOW_TYPE = 'Workflow'
