import type { Metadata } from '../types/metadata.js'

// Internal registry for metadata definitions not present in SDR
// or that need special handling different from SDR's structure
// Priority: internalRegistry > SDR > additionalMetadataRegistry

export default [
  // CustomLabel needs suffix even though it matches parent in SDR
  {
    directoryName: 'labels',
    inFolder: false,
    metaFile: false,
    parentXmlName: 'CustomLabels',
    xmlName: 'CustomLabel',
    childXmlNames: ['CustomLabel'],
    suffix: 'labels',
    xmlTag: 'labels',
    key: 'fullName',
  },
  // Child type for field translations within CustomObjectTranslation files.
  // Maps .fieldTranslation suffix to CustomObjectTranslation type.
  {
    directoryName: 'objectTranslations',
    inFolder: false,
    metaFile: false,
    parentXmlName: 'CustomObjectTranslation',
    suffix: 'fieldTranslation',
    xmlName: 'CustomObjectTranslation',
    xmlTag: 'fields',
    key: 'name',
    excluded: true,
  },
  // Overriding SDR CustomFieldTranslation to prevent it from matching 'fields' directory
  // and shadowing CustomField. We disable it effectively by giving it bogus directory/suffix.
  {
    xmlName: 'CustomFieldTranslation',
    directoryName: 'disabled_custom_field_translation',
    suffix: 'disabled_fieldTranslation',
    inFolder: false,
    metaFile: false,
    excluded: true,
  },
  // pruneOnly types - only handled for deletions (destructiveChanges)
  {
    directoryName: 'globalValueSetTranslations',
    inFolder: false,
    metaFile: false,
    suffix: 'globalValueSetTranslation',
    xmlName: 'GlobalValueSetTranslation',
    xmlTag: undefined,
    pruneOnly: true,
  },
  {
    directoryName: 'standardValueSetTranslations',
    inFolder: false,
    metaFile: false,
    suffix: 'standardValueSetTranslation',
    xmlName: 'StandardValueSetTranslation',
    xmlTag: undefined,
    pruneOnly: true,
  },
  {
    directoryName: 'profiles',
    inFolder: false,
    metaFile: false,
    suffix: 'profile',
    xmlName: 'Profile',
    xmlTag: undefined,
    pruneOnly: true,
  },
  // NOTE: CustomObjectTranslation pruneOnly entry is added in metadataManager
  // after the merge to avoid xmlName collision with the fieldTranslation entry above.
  {
    directoryName: 'translations',
    inFolder: false,
    metaFile: false,
    suffix: 'translation',
    xmlName: 'Translations',
    xmlTag: undefined,
    pruneOnly: true,
  },

  {
    directoryName: 'bots',
    inFolder: false,
    metaFile: true,
    xmlName: 'VirtualBot',
    content: [
      {
        suffix: 'bot',
        xmlName: 'Bot',
      },
      {
        suffix: 'botVersion',
        xmlName: 'BotVersion',
      },
    ],
  },
  {
    xmlName: 'ValueTranslation',
    suffix: 'valueTranslation',
    directoryName: 'none',
    inFolder: false,
    metaFile: false,
    parentXmlName: 'GlobalValueSetTranslation',
    xmlTag: 'valueTranslation',
  },
  {
    directoryName: 'discovery',
    inFolder: false,
    metaFile: true,
    xmlName: 'VirtualDiscovery',
    content: [
      {
        suffix: 'model',
        xmlName: 'DiscoveryAIModel',
      },
      {
        suffix: 'goal',
        xmlName: 'DiscoveryGoal',
      },
    ],
  },
  {
    directoryName: 'moderation',
    inFolder: false,
    metaFile: true,
    xmlName: 'VirtualModeration',
    content: [
      {
        suffix: 'keywords',
        xmlName: 'KeywordList',
      },
      {
        suffix: 'rule',
        xmlName: 'ModerationRule',
      },
    ],
  },
  {
    directoryName: 'wave',
    inFolder: false,
    metaFile: true,
    xmlName: 'VirtualWave',
    content: [
      {
        suffix: 'wapp',
        xmlName: 'WaveApplication',
      },
      {
        suffix: 'wcomp',
        xmlName: 'WaveComponent',
      },
      {
        suffix: 'wdf',
        xmlName: 'WaveDataflow',
      },
      {
        suffix: 'wdash',
        xmlName: 'WaveDashboard',
      },
      {
        suffix: 'wds',
        xmlName: 'WaveDataset',
      },
      {
        suffix: 'wlens',
        xmlName: 'WaveLens',
      },
      {
        suffix: 'wtemplate',
        xmlName: 'WaveTemplateBundle',
      },
      {
        suffix: 'wdpr',
        xmlName: 'WaveRecipe',
      },
      {
        suffix: 'xmd',
        xmlName: 'WaveXmd',
      },
    ],
  },
] as Metadata[]
