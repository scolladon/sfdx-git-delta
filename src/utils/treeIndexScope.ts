'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import {
  CONTENT_CONTAINER_ADAPTERS,
  DASHBOARD_TYPE,
  OBJECT_TYPE,
  PERMISSIONSET_TYPE,
  REPORT_TYPE,
} from '../constant/metadataConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'
import { pathOfLine } from './gitLine.js'

const TREE_INDEX_XML_NAMES = new Set([
  OBJECT_TYPE,
  DASHBOARD_TYPE,
  REPORT_TYPE,
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'UIBundle',
  'GenAiFunction',
  PERMISSIONSET_TYPE,
  'Territory2Model',
  'ExternalServiceRegistration',
])

const needsTreeIndex = (type: Metadata): boolean => {
  if (type.xmlName && TREE_INDEX_XML_NAMES.has(type.xmlName)) return true
  if (type.inFolder) return true
  if (type.adapter && CONTENT_CONTAINER_ADAPTERS.has(type.adapter)) return true
  return false
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
// type directory is the one a listing must cover.
const indexedTypeOf = (
  path: string,
  metadata: MetadataRepository
): Metadata | undefined => {
  const type = metadata.get(path)
  if (!type?.parentXmlName) return type
  return metadata.getByXmlName(type.parentXmlName)
}

export const componentListingRoot = (
  path: string,
  metadata: MetadataRepository
): string | null => {
  const indexedType = indexedTypeOf(path, metadata)
  if (!indexedType) return null

  return scopeForType(path.split(PATH_SEP), indexedType)
}

const scopeForLine = (
  line: string,
  metadata: MetadataRepository
): string | null => {
  const path = pathOfLine(line)
  const indexedType = indexedTypeOf(path, metadata)
  if (!indexedType || !needsTreeIndex(indexedType)) return null

  return scopeForType(path.split(PATH_SEP), indexedType)
}

export const computeTreeIndexScope = (
  lines: Iterable<string>,
  metadata: MetadataRepository
): Set<string> => {
  const scope = new Set<string>()

  for (const line of lines) {
    const result = scopeForLine(line, metadata)
    if (result) {
      scope.add(result)
    }
  }

  return scope
}
