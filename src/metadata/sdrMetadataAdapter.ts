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
      const baseFolderTypeIds = new Set(
        types
          .filter(t => t.inFolder && t.folderType)
          .map(t => t.folderType as string)
      )
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
          const hasDifferentDirectory =
            childDirName && childDirName !== sdrType.directoryName
          const skipSuffix =
            child.suffix === sdrType.suffix && !hasDifferentDirectory

          result.push(
            this.convertChildType(
              child,
              sdrType.name,
              skipSuffix,
              childDirName,
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
    if (child.xmlElementName && directoryNames.has(child.xmlElementName)) {
      return child.xmlElementName
    }
    return child.directoryName ?? ''
  }

  private convertType(sdrType: SDRMetadataType): Metadata {
    // Build content array for types that need it (Dashboard, Report, EmailTemplate)
    const needsContent = TYPES_WITH_CONTENT_ARRAY.has(sdrType.id)
    let content: SharedFolderMetadata[] | undefined

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
      inFolder: false,
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
    return adapter ? CONTENT_FILE_ADAPTERS.has(adapter) : false
  }
}
