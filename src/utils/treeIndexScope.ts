'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import { GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'

const BUNDLE_ADAPTERS = new Set(['bundle', 'digitalExperience'])

const TREE_INDEX_XML_NAMES = new Set([
  'CustomObject',
  'Dashboard',
  'Report',
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'GenAiFunction',
  'PermissionSet',
  'Territory2Model',
])

const needsTreeIndex = (type: Metadata): boolean => {
  if (type.xmlName && TREE_INDEX_XML_NAMES.has(type.xmlName)) return true
  if (type.inFolder) return true
  if (
    type.adapter &&
    (BUNDLE_ADAPTERS.has(type.adapter) || type.adapter === 'mixedContent')
  )
    return true
  return false
}

const buildParentIndex = (
  metadata: MetadataRepository
): Map<string, Metadata> => {
  const index = new Map<string, Metadata>()
  for (const m of metadata.values()) {
    if (m.xmlName) {
      index.set(m.xmlName, m)
    }
  }
  return index
}

const scopeForType = (parts: string[], type: Metadata): string | null => {
  const dirIndex = parts.indexOf(type.directoryName)
  if (dirIndex < 0) return null

  if (type.adapter && BUNDLE_ADAPTERS.has(type.adapter)) {
    if (dirIndex + 1 < parts.length) {
      return parts.slice(0, dirIndex + 2).join(PATH_SEP)
    }
    return parts.slice(0, dirIndex + 1).join(PATH_SEP)
  }

  return parts.slice(0, dirIndex + 1).join(PATH_SEP)
}

export const computeTreeIndexScope = (
  lines: string[],
  metadata: MetadataRepository
): Set<string> => {
  const scope = new Set<string>()
  const parentIndex = buildParentIndex(metadata)

  for (const line of lines) {
    const path = line.replace(GIT_DIFF_TYPE_REGEX, '')
    const type = metadata.get(path)
    if (!type) continue

    const parts = path.split(PATH_SEP)

    if (type.parentXmlName) {
      const parent = parentIndex.get(type.parentXmlName)
      if (parent && needsTreeIndex(parent)) {
        const result = scopeForType(parts, parent)
        if (result) {
          scope.add(result)
        }
      }
      continue
    }

    if (!needsTreeIndex(type)) continue

    const result = scopeForType(parts, type)
    if (result) {
      scope.add(result)
    }
  }

  return scope
}
