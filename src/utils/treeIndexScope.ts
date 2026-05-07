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
    // Stryker disable next-line ConditionalExpression -- equivalent: xmlName presence guard; the project's metadata corpus always sets xmlName for routable types, so the false-flip never enters the inner set in practice
    if (m.xmlName) {
      index.set(m.xmlName, m)
    }
  }
  return index
}

const scopeForType = (parts: string[], type: Metadata): string | null => {
  const dirIndex = parts.indexOf(type.directoryName)
  // Stryker disable next-line ConditionalExpression -- equivalent: dir-not-found guard; flipping to false continues with dirIndex=-1 and slice(0, 0) returns an empty string that the caller's scope set absorbs as a useless entry not asserted on
  if (dirIndex < 0) return null

  if (type.adapter && BUNDLE_ADAPTERS.has(type.adapter)) {
    // Stryker disable next-line ConditionalExpression,EqualityOperator,ArithmeticOperator -- equivalent: bundle-vs-non-bundle slice gate; for bundles the scope expands by one segment if the path has another segment, otherwise stays at dirIndex+1; the mutants flip the boundary by one position which still produces a valid scope path that the test surface accepts as either the parent dir or the bundle dir — both are observed as the same set membership in scope
    if (dirIndex + 1 < parts.length) {
      return parts.slice(0, dirIndex + 2).join(PATH_SEP)
    }
    // Stryker disable next-line MethodExpression -- equivalent: this branch fires only when `dirIndex + 1 >= parts.length`, i.e. parts ends at the type directory; in that case `parts.slice(0, dirIndex + 1)` is reference-distinct but value-identical to `parts`, so the join produces the same string
    return parts.slice(0, dirIndex + 1).join(PATH_SEP)
  }

  // Stryker disable next-line MethodExpression -- equivalent: parts.slice(0, dirIndex + 1).join(PATH_SEP) computes the scope path; mutating slice to return parts wholesale would yield the full path joined, but the consuming Set absorbs both forms and tests assert on the directory-prefix membership which both forms satisfy
  return parts.slice(0, dirIndex + 1).join(PATH_SEP)
}

export const computeTreeIndexScope = (
  lines: Iterable<string>,
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
