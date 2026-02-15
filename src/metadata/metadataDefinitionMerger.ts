'use strict'

import type { Metadata } from '../types/metadata.js'

export class MetadataDefinitionMerger {
  constructor(private readonly baseMetadata: Metadata[]) {}

  public merge(additionalMetadata: Metadata[]): Metadata[] {
    const mergedMap = new Map<string, Metadata>()

    // 1. Start with Additional (SDR) items
    for (const item of additionalMetadata) {
      if (item.xmlName) {
        mergedMap.set(item.xmlName, item)
      }
    }

    // 2. Merge Base (Internal) items into map (Overrides) or Append
    // We treat Base as having priority overrides.
    // AND Base unique items should come LAST to override suffix mapping in Repository.

    for (const baseItem of this.baseMetadata) {
      if (!baseItem.xmlName) continue

      const existing = mergedMap.get(baseItem.xmlName)
      if (existing) {
        // Merge: Base properties override existing (additional)
        mergedMap.set(baseItem.xmlName, { ...existing, ...baseItem })
      } else {
        // Add new
        mergedMap.set(baseItem.xmlName, baseItem)
      }
    }

    return Array.from(mergedMap.values())
  }
}
