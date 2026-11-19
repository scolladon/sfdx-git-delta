// Classifies internal registry entries for syncInternalRegistryWithSdr.ts.
// Kept apart from that script — which reads SDR and writes the registry at
// import time, so never loads under the unit run — so the removal predicate
// is itself unit-tested.

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
