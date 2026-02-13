#!/usr/bin/env node
// Reads coverage-result.json from the check script, removes auto-removable
// redundant types from the internal registry, and rewrites the file.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import internalRegistry from '../src/metadata/internalRegistry.js'

interface RedundantType {
  xmlName: string
  isAutoRemovable: boolean
}

interface CoverageResult {
  sdrTypeCount: number
  internalTypeCount: number
  redundantInternalTypes: RedundantType[]
}

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

// Read coverage result
const coveragePath = resolve(process.argv[2] ?? 'coverage-result.json')
const coverageData: CoverageResult = JSON.parse(
  readFileSync(coveragePath, 'utf-8')
)

const toRemove = new Set(
  coverageData.redundantInternalTypes
    .filter(t => t.isAutoRemovable)
    .map(t => t.xmlName)
)

if (toRemove.size === 0) {
  console.log('No auto-removable redundant types found. Registry is clean.')
  process.exit(0)
}

console.log(`Removing ${toRemove.size} auto-removable gap-filler(s):`)
for (const name of toRemove) {
  console.log(`  - ${name}`)
}

// Filter out removable entries
const remaining = internalRegistry.filter(
  entry => !entry.xmlName || !toRemove.has(entry.xmlName)
)

// Group by category
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
    `// SDR gap-fillers: types not yet in SDR registry.\n  // Automatically removed by tooling/sync-internal-registry.ts when SDR adds them.`,
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
console.log(`Updated ${registryPath}`)
