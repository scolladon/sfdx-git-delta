#!/usr/bin/env node
// Compares internal registry against SDR and removes auto-removable
// gap-filler types that SDR now covers natively.
// If nothing to remove, the registry file is left untouched.

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { registry } from '@salesforce/source-deploy-retrieve'
import internalRegistry from '../src/metadata/internalRegistry.js'

const SPECIAL_FIELDS = [
  'xmlTag',
  'key',
  'content',
  'excluded',
  'pruneOnly',
  'parentXmlName',
  'childXmlNames',
] as const

function isSimpleGapFiller(entry: (typeof internalRegistry)[number]): boolean {
  if (!entry.directoryName || !entry.suffix) return false
  return !SPECIAL_FIELDS.some(
    field => (entry as Record<string, unknown>)[field] != null
  )
}

// Collect all xmlNames from SDR
const sdrXmlNames = new Set<string>()

for (const sdrType of Object.values(registry.types)) {
  sdrXmlNames.add(sdrType.name)

  if (sdrType.children?.types) {
    for (const child of Object.values(sdrType.children.types)) {
      sdrXmlNames.add(child.name)
    }
  }

  if (sdrType.folderType) {
    const folderType =
      registry.types[sdrType.folderType as keyof typeof registry.types]
    if (folderType) {
      sdrXmlNames.add(folderType.name)
    }
  }
}

// Find auto-removable redundant types (simple gap-fillers now covered by SDR)
const toRemove = new Set(
  internalRegistry
    .filter(
      entry =>
        entry.xmlName &&
        sdrXmlNames.has(entry.xmlName) &&
        isSimpleGapFiller(entry)
    )
    .map(entry => entry.xmlName!)
)

if (toRemove.size === 0) {
  console.log('No auto-removable redundant types found. Registry is clean.')
  process.exit(0)
}

console.log(`\nRemoving ${toRemove.size} auto-removable gap-filler(s):`)
for (const name of toRemove) {
  console.log(`  - ${name}`)
}

// Filter out removable entries
const remaining = internalRegistry.filter(
  entry => !entry.xmlName || !toRemove.has(entry.xmlName)
)

// Group by category for organized output
function categorize(entry: (typeof internalRegistry)[number]): string {
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

function serializeEntry(entry: (typeof internalRegistry)[number]): string {
  const lines: string[] = []
  lines.push('  {')

  if (entry.childXmlNames) {
    lines.push(
      `    childXmlNames: [${entry.childXmlNames.map(n => `'${n}'`).join(', ')}],`
    )
  }
  if (entry.content) {
    lines.push('    content: [')
    for (const c of entry.content) {
      lines.push('      {')
      if (c.suffix) lines.push(`        suffix: '${c.suffix}',`)
      if (c.xmlName) lines.push(`        xmlName: '${c.xmlName}',`)
      lines.push('      },')
    }
    lines.push('    ],')
  }
  if (entry.directoryName !== undefined)
    lines.push(`    directoryName: '${entry.directoryName}',`)
  if (entry.excluded) lines.push(`    excluded: ${entry.excluded},`)
  lines.push(`    inFolder: ${entry.inFolder},`)
  if (entry.key) lines.push(`    key: '${entry.key}',`)
  lines.push(`    metaFile: ${entry.metaFile},`)
  if (entry.parentXmlName)
    lines.push(`    parentXmlName: '${entry.parentXmlName}',`)
  if (entry.pruneOnly) lines.push(`    pruneOnly: ${entry.pruneOnly},`)
  if (entry.suffix) lines.push(`    suffix: '${entry.suffix}',`)
  if (entry.xmlName) lines.push(`    xmlName: '${entry.xmlName}',`)
  if (entry.xmlTag !== undefined) {
    lines.push(
      `    xmlTag: ${entry.xmlTag === undefined ? 'undefined' : `'${entry.xmlTag}'`},`
    )
  }

  lines.push('  },')
  return lines.join('\n')
}

const groups: Record<string, typeof internalRegistry> = {}
for (const entry of remaining) {
  const cat = categorize(entry)
  if (!groups[cat]) {
    groups[cat] = []
  }
  groups[cat].push(entry)
}

// Generate output
const sections: string[] = []

const sectionOrder: [string, string][] = [
  ['specialHandling', '// Special handling overrides'],
  [
    'pruneOnly',
    '// pruneOnly types - only handled for deletions (destructiveChanges)',
  ],
  [
    'profileChildren',
    "// Profile children - SDR doesn't define these, needed for granular diff",
  ],
  [
    'translationsChildren',
    "// Translations children - SDR doesn't define these, needed for granular diff",
  ],
  [
    'marketingAppExt',
    '// MarketingAppExtActivity - child type with special handling',
  ],
  ['valueTranslation', ''],
  ['virtual', ''],
  [
    'gapFiller',
    `// SDR gap-fillers: types not yet in SDR registry.\n  // Automatically removed by tooling/syncInternalRegistryWithSdr.ts when SDR adds them.`,
  ],
]

for (const [key, comment] of sectionOrder) {
  const entries = groups[key]
  if (!entries?.length) continue
  const block: string[] = []
  if (comment) block.push(`  ${comment}`)
  for (const entry of entries) {
    block.push(serializeEntry(entry))
  }
  sections.push(block.join('\n'))
}

const output = `import type { Metadata } from '../types/metadata.js'

// Internal registry for metadata definitions not present in SDR
// or that need special handling different from SDR's structure
// Priority: internalRegistry > SDR > additionalMetadataRegistry

export default [
${sections.join('\n\n')}
] as Metadata[]
`

const registryPath = resolve(
  import.meta.dirname ?? '.',
  '../src/metadata/internalRegistry.ts'
)
writeFileSync(registryPath, output)
console.log(`\nUpdated ${registryPath}`)
