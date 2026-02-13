#!/usr/bin/env node
// Compares internal registry against SDR.
// Outputs JSON with type counts and redundant internal types.

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

type SpecialField = (typeof SPECIAL_FIELDS)[number]

function isSimpleGapFiller(entry: (typeof internalRegistry)[number]): boolean {
  if (!entry.directoryName || !entry.suffix) return false
  return !SPECIAL_FIELDS.some(
    field => (entry as Record<string, unknown>)[field as SpecialField] != null
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

// Find redundant internal types (present in both SDR and internal registry)
const redundantInternalTypes = internalRegistry
  .filter(entry => entry.xmlName && sdrXmlNames.has(entry.xmlName))
  .map(entry => ({
    xmlName: entry.xmlName!,
    isAutoRemovable: isSimpleGapFiller(entry),
  }))

const result = {
  sdrTypeCount: sdrXmlNames.size,
  internalTypeCount: internalRegistry.length,
  redundantInternalTypes,
}

console.log(JSON.stringify(result, null, 2))
