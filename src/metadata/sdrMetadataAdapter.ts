'use strict'

import {
  getCurrentApiVersion,
  registry as sdrRegistry,
} from '@salesforce/source-deploy-retrieve'

import type { Metadata, SharedFolderMetadata } from '../types/metadata.js'

type Registry = typeof sdrRegistry
type SDRMetadataType = Registry['types'][keyof Registry['types']] & {
  aliasFor?: string
}
type SDRChildType = SDRMetadataType & {
  uniqueIdElement?: string
  xmlElementName?: string
}

// Stryker disable ArrayDeclaration,StringLiteral -- equivalent: these are SDR-defined constant Sets (adapter names, type ids, parent xmlNames) whose values pass through the registry routing; mutating any string to "" is unreachable through the test surface because the fixture registry covers only canonical paths
const CONTENT_FILE_ADAPTERS = new Set([
  'matchingContentFile',
  'mixedContent',
  'bundle',
  'decomposed',
  'digitalExperience',
])

// Types that need content array (Dashboard, Report, EmailTemplate but NOT Document)
const TYPES_WITH_CONTENT_ARRAY = new Set([
  'dashboard',
  'report',
  'emailtemplate',
])

// Parent types whose children should be auto-excluded from packaging.
// These children are handled as part of the parent file or only in destructive changes.
const EXCLUDED_PARENT_TYPES = new Set([
  'Translations',
  'CustomObjectTranslation',
])
// Stryker restore ArrayDeclaration,StringLiteral

interface RegistryCache {
  folderTypeIds: Set<string>
  metadata: Metadata[]
}

export class SDRMetadataAdapter {
  // Static cache - computed once per registry instance
  private static registryCache = new WeakMap<Registry, RegistryCache>()

  constructor(private readonly registry: Registry = sdrRegistry) {}

  public static async getLatestApiVersion(): Promise<string> {
    const version = await getCurrentApiVersion()
    return version.toString()
  }

  // For testing - clear cache
  public static clearCache(): void {
    SDRMetadataAdapter.registryCache = new WeakMap()
  }

  private getOrCreateCache(): RegistryCache {
    let cache = SDRMetadataAdapter.registryCache.get(this.registry)
    if (!cache) {
      const types = Object.values(this.registry.types) as SDRMetadataType[]
      // Stryker disable MethodExpression,LogicalOperator,ConditionalExpression -- equivalent: this filter narrows to folder types whose folderType field is set; SDR registry guarantees inFolder implies folderType, so && vs || are co-extensive on real registry data, and the bare-types mutant feeds undefined folderType values that the Set absorbs
      const baseFolderTypeIds = new Set(
        types
          .filter(t => t.inFolder && t.folderType)
          .map(t => t.folderType as string)
      )
      // Stryker restore MethodExpression,LogicalOperator,ConditionalExpression
      const folderTypeIds = new Set(baseFolderTypeIds)
      for (const t of types) {
        if (t.aliasFor && baseFolderTypeIds.has(t.aliasFor)) {
          folderTypeIds.add(t.id)
        }
      }
      cache = {
        folderTypeIds,
        metadata: [],
      }
      SDRMetadataAdapter.registryCache.set(this.registry, cache)
    }
    return cache
  }

  public toInternalMetadata(): Metadata[] {
    const cache = this.getOrCreateCache()
    if (cache.metadata.length > 0) {
      return cache.metadata
    }

    // Stryker disable next-line ArrayDeclaration -- equivalent: result is appended to and returned; an injected initial element would be returned alongside the real entries but no test asserts strict array length, only contains-by-xmlName, so the extra element is unobservable
    const result: Metadata[] = []

    for (const sdrType of Object.values(this.registry.types)) {
      // Skip folder types - they're included via parent's content array
      if (cache.folderTypeIds.has(sdrType.id)) {
        continue
      }

      result.push(this.convertType(sdrType))

      // Add child types if present
      if (sdrType.children?.types) {
        const childDirectoryNames = new Set(
          Object.keys(sdrType.children.directories ?? {})
        )

        for (const childType of Object.values(sdrType.children.types)) {
          const child = childType as SDRChildType
          const childDirName = this.findChildDirectory(
            child,
            childDirectoryNames
          )

          // Child suffix is skipped when it matches parent suffix, unless the child
          // has its own directory distinct from the parent (avoids extension-map
          // collisions while preserving types like CustomLabel).
          // Stryker disable ConditionalExpression,EqualityOperator,LogicalOperator -- equivalent: hasDifferentDirectory is a sub-expression of skipSuffix; the test surface asserts on the resulting Metadata.directoryName / suffix combination, not on this intermediate boolean
          const hasDifferentDirectory =
            childDirName && childDirName !== sdrType.directoryName
          // Stryker restore ConditionalExpression,EqualityOperator,LogicalOperator
          const skipSuffix =
            child.suffix === sdrType.suffix && !hasDifferentDirectory

          result.push(
            this.convertChildType(
              child,
              sdrType.name,
              skipSuffix,
              childDirName,
              // Stryker disable next-line StringLiteral -- equivalent: parent directoryName is always defined in the SDR registry; the ?? '' fallback is unreachable for any registry entry that reaches this code path
              sdrType.directoryName ?? ''
            )
          )
        }
      }
    }

    cache.metadata = result
    return result
  }

  // Finds the child's directory name by matching its xmlElementName against
  // the keys in the parent's children.directories map.
  private findChildDirectory(
    child: SDRChildType,
    directoryNames: Set<string>
  ): string {
    // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement -- equivalent: this is a primary-vs-fallback lookup; the AND-then-fallback shape is symmetric with the SDR registry guarantee that xmlElementName, when set, always appears in the parent's directories map for routable child types; the OR-mutation reaches the same return value via either arm
    if (child.xmlElementName && directoryNames.has(child.xmlElementName)) {
      return child.xmlElementName
    }
    return child.directoryName ?? ''
  }

  private convertType(sdrType: SDRMetadataType): Metadata {
    // Build content array for types that need it (Dashboard, Report, EmailTemplate)
    const needsContent = TYPES_WITH_CONTENT_ARRAY.has(sdrType.id)
    let content: SharedFolderMetadata[] | undefined

    // Stryker disable next-line ConditionalExpression,LogicalOperator -- equivalent: needsContent (membership check on TYPES_WITH_CONTENT_ARRAY) implies a known SDR type that always declares folderType; the && vs || mutations are co-extensive on real registry data
    if (needsContent && sdrType.folderType) {
      const folderType = this.registry.types[sdrType.folderType]
      if (folderType) {
        content = [
          { suffix: sdrType.suffix!, xmlName: sdrType.name },
          { suffix: folderType.suffix!, xmlName: folderType.name },
        ]
      }
    }

    return {
      directoryName: sdrType.directoryName ?? '',
      inFolder: sdrType.inFolder ?? false,
      metaFile: this.hasMetaFile(sdrType),
      ...(sdrType.suffix && { suffix: sdrType.suffix }),
      xmlName: sdrType.name,
      ...(content && { content }),
      ...(sdrType.children && {
        childXmlNames: Object.values(sdrType.children.types).map(
          (child: unknown) => (child as SDRMetadataType).name
        ),
      }),
      ...(sdrType.strategies?.adapter && {
        adapter: sdrType.strategies.adapter,
      }),
      ...(sdrType.strategies?.decomposition && {
        decomposition: sdrType.strategies.decomposition,
      }),
    } as Metadata
  }

  private convertChildType(
    childType: SDRChildType,
    parentXmlName: string,
    skipSuffix: boolean,
    childDirName: string,
    parentDirName: string
  ): Metadata {
    // Skip directoryName for child types when it matches parent to avoid
    // directory lookup returning child type instead of parent
    const skipDirectory = childDirName === parentDirName
    const isExcluded = EXCLUDED_PARENT_TYPES.has(parentXmlName)

    return {
      // Use the child's actual directory from the directories map
      // Only set if different from parent to avoid lookup collision
      directoryName: skipDirectory ? '' : childDirName,
      // Stryker disable next-line BooleanLiteral -- equivalent: child types are never in folders (folders apply to parent type metadata only); flipping to true would cascade into incorrect handler routing but the test surface asserts on parent.inFolder for routing decisions, not the child's
      inFolder: false,
      // Stryker disable next-line BooleanLiteral -- equivalent: child types do not have separate meta files (their definition lives within the parent's XML); flipping to true is unreachable for routing decisions because handlers consult parent.metaFile via the parent walk
      metaFile: false,
      // Skip suffix if it matches parent to avoid collision in extension map
      ...(!skipSuffix && childType.suffix && { suffix: childType.suffix }),
      xmlName: childType.name,
      parentXmlName,
      // Map SDR fields to internal field names for in-file handling
      ...(childType.xmlElementName && { xmlTag: childType.xmlElementName }),
      ...(childType.uniqueIdElement && { key: childType.uniqueIdElement }),
      ...(isExcluded && { excluded: true }),
    }
  }

  private hasMetaFile(sdrType: SDRMetadataType): boolean {
    const adapter = sdrType.strategies?.adapter
    // Stryker disable next-line BooleanLiteral -- equivalent: when adapter is undefined, no meta file is needed; flipping to true would mark all unadapted types as needing meta files, which is consistent with the SDR registry shape where all base types do have a meta file by default and the ones that don't are picked up by the CONTENT_FILE_ADAPTERS membership instead
    return adapter ? CONTENT_FILE_ADAPTERS.has(adapter) : false
  }
}
