// Classifies and serializes internal registry entries for
// syncInternalRegistryWithSdr.ts. Kept apart from that script — which reads
// SDR, may exit the process and writes the registry at import time, and so
// never loads under the unit run — so the generated file's shape is itself
// unit-tested.

import type { Metadata } from '../src/types/metadata.ts'

const SPECIAL_FIELDS = [
  'xmlTag',
  'key',
  'content',
  'excluded',
  'pruneOnly',
  'parentXmlName',
  'childXmlNames',
] as const

export function isSimpleGapFiller(entry: Metadata): boolean {
  if (!entry.directoryName || !entry.suffix) return false
  return !SPECIAL_FIELDS.some(
    field => (entry as Record<string, unknown>)[field] != null
  )
}

// The section keys syncInternalRegistryWithSdr.ts emits, in its sectionOrder;
// an entry whose category is missing there is silently dropped from the file.
export type RegistryCategory =
  | 'specialHandling'
  | 'pruneOnly'
  | 'profileChildren'
  | 'translationsChildren'
  | 'marketingAppExt'
  | 'valueTranslation'
  | 'virtual'
  | 'gapFiller'

export function categorize(entry: Metadata): RegistryCategory {
  if (entry.xmlName?.startsWith('Virtual')) return 'virtual'
  if (entry.content) return 'virtual'
  if (entry.pruneOnly) return 'pruneOnly'
  if (entry.parentXmlName === 'Profile') return 'profileChildren'
  if (entry.parentXmlName === 'Translations') return 'translationsChildren'
  if (entry.parentXmlName === 'MarketingAppExtension') return 'marketingAppExt'
  if (entry.parentXmlName === 'GlobalValueSetTranslation')
    return 'valueTranslation'
  if (
    entry.xmlName === 'CustomLabel' ||
    entry.xmlName === 'CustomFieldTranslation'
  )
    return 'specialHandling'
  if (entry.xmlName === 'CustomObjectTranslation') return 'specialHandling'
  if (isSimpleGapFiller(entry)) return 'gapFiller'
  return 'specialHandling'
}

type EntryFieldSerializer = (entry: Metadata) => readonly string[]

const serializeContent = (
  content: NonNullable<Metadata['content']>
): readonly string[] => [
  '    content: [',
  ...content.flatMap(c => [
    '      {',
    ...(c.suffix ? [`        suffix: '${c.suffix}',`] : []),
    ...(c.xmlName ? [`        xmlName: '${c.xmlName}',`] : []),
    '      },',
  ]),
  '    ],',
]

// Order is the generated file's field order; reordering rewrites every entry.
const ENTRY_FIELD_SERIALIZERS: readonly EntryFieldSerializer[] = [
  e =>
    e.childXmlNames
      ? [
          `    childXmlNames: [${e.childXmlNames.map(n => `'${n}'`).join(', ')}],`,
        ]
      : [],
  e => (e.content ? serializeContent(e.content) : []),
  e =>
    e.directoryName !== undefined
      ? [`    directoryName: '${e.directoryName}',`]
      : [],
  e => (e.excluded ? [`    excluded: ${e.excluded},`] : []),
  e => [`    inFolder: ${e.inFolder},`],
  e => (e.key ? [`    key: '${e.key}',`] : []),
  e => [`    metaFile: ${e.metaFile},`],
  e => (e.parentXmlName ? [`    parentXmlName: '${e.parentXmlName}',`] : []),
  e => (e.pruneOnly ? [`    pruneOnly: ${e.pruneOnly},`] : []),
  e => (e.suffix ? [`    suffix: '${e.suffix}',`] : []),
  e => (e.xmlName ? [`    xmlName: '${e.xmlName}',`] : []),
  e => (e.xmlTag !== undefined ? [`    xmlTag: '${e.xmlTag}',`] : []),
]

export function serializeEntry(entry: Metadata): string {
  return [
    '  {',
    ...ENTRY_FIELD_SERIALIZERS.flatMap(serialize => serialize(entry)),
    '  },',
  ].join('\n')
}
