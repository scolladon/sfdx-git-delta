'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import { GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import {
  CONTENT_CONTAINER_ADAPTERS,
  DASHBOARD_TYPE,
  OBJECT_TYPE,
  PERMISSIONSET_TYPE,
  REPORT_TYPE,
} from '../constant/metadataConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'

const TREE_INDEX_XML_NAMES = new Set([
  OBJECT_TYPE,
  DASHBOARD_TYPE,
  REPORT_TYPE,
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'GenAiFunction',
  PERMISSIONSET_TYPE,
  'Territory2Model',
])

const needsTreeIndex = (type: Metadata): boolean => {
  if (type.xmlName && TREE_INDEX_XML_NAMES.has(type.xmlName)) return true
  if (type.inFolder) return true
  if (type.adapter && CONTENT_CONTAINER_ADAPTERS.has(type.adapter)) return true
  return false
}

const buildParentIndex = (
  metadata: MetadataRepository
): Map<string, Metadata> => {
  const index = new Map<string, Metadata>()
  for (const m of metadata.values()) {
    // Stryker disable next-line ConditionalExpression -- equivalent: xmlName presence guard; the project's metadata corpus always sets xmlName for routable types, so the false-flip never enters the inner set in practice
    if (m.xmlName) {
      index.set(m.xmlName, m)
    }
  }
  return index
}

// Every tree-index-needing type scopes to its type directory, regardless of
// adapter: a bundle's liveness check (pathExists on its component directory)
// answers identically whether the index was built from just that component
// or from the whole type directory, so there is no need to slice deeper for
// bundle-style adapters.
const scopeForType = (parts: string[], type: Metadata): string | null => {
  const dirIndex = parts.indexOf(type.directoryName)
  if (dirIndex < 0) return null

  return parts.slice(0, dirIndex + 1).join(PATH_SEP)
}

// A child type (parentXmlName) is indexed through its parent: the parent's
// type directory is the one the index must cover.
const scopeForLine = (
  line: string,
  metadata: MetadataRepository,
  parentIndex: Map<string, Metadata>
): string | null => {
  const path = line.replace(GIT_DIFF_TYPE_REGEX, '')
  const type = metadata.get(path)
  if (!type) return null

  const indexedType = type.parentXmlName
    ? parentIndex.get(type.parentXmlName)
    : type
  if (!indexedType || !needsTreeIndex(indexedType)) return null

  return scopeForType(path.split(PATH_SEP), indexedType)
}

export const computeTreeIndexScope = (
  lines: Iterable<string>,
  metadata: MetadataRepository
): Set<string> => {
  const scope = new Set<string>()
  const parentIndex = buildParentIndex(metadata)

  for (const line of lines) {
    const result = scopeForLine(line, metadata, parentIndex)
    if (result) {
      scope.add(result)
    }
  }

  return scope
}
