// Classifies and serializes internal registry entries for
// syncInternalRegistryWithSdr.ts. Kept apart from that script — which reads
// SDR, may exit the process and writes the registry at import time, and so
// never loads under the unit run — so the generated file's shape is itself
// unit-tested.

import type { Metadata } from '../src/types/metadata.ts'

const GAP_FILLER_FIELD_NAMES = [
  'xmlName',
  'directoryName',
  'suffix',
  'inFolder',
  'metaFile',
] as const satisfies readonly (keyof Metadata)[]

// Key presence, not value: the runtime merger spreads an override over the
// SDR entry, so an explicit `undefined` still blanks the SDR value.
export const GAP_FILLER_FIELDS: ReadonlySet<string> = new Set(
  GAP_FILLER_FIELD_NAMES
)

export function isSimpleGapFiller(entry: Metadata): boolean {
  if (!entry.directoryName || !entry.suffix) return false
  return Object.keys(entry).every(field => GAP_FILLER_FIELDS.has(field))
}

const isSdrKnown = (
  entry: Metadata,
  sdrXmlNames: ReadonlySet<string>
): entry is Metadata & { xmlName: string } =>
  entry.xmlName !== undefined && sdrXmlNames.has(entry.xmlName)

export function selectRemovableEntries(
  entries: readonly Metadata[],
  sdrXmlNames: ReadonlySet<string>
): ReadonlySet<number> {
  return new Set(
    entries.flatMap((entry, index) =>
      isSdrKnown(entry, sdrXmlNames) && isSimpleGapFiller(entry) ? [index] : []
    )
  )
}

export function selectRetainedOverrides(
  entries: readonly Metadata[],
  sdrXmlNames: ReadonlySet<string>
): readonly string[] {
  return entries.flatMap(entry =>
    isSdrKnown(entry, sdrXmlNames) && !isSimpleGapFiller(entry)
      ? [entry.xmlName]
      : []
  )
}

// Each category is one section of the generated registry file;
// syncInternalRegistryWithSdr.ts keys its section headers by this type.
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
