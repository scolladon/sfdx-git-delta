'use strict'

import {
  getCurrentApiVersion,
  registry,
} from '@salesforce/source-deploy-retrieve'

import type { Metadata, SharedFolderMetadata } from '../types/metadata.js'

type SDRMetadataType = (typeof registry.types)[keyof typeof registry.types]
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

// Folder type IDs that should be EXCLUDED from the output as standalone types.
// They are instead included via the `content` array of their parent inFolder type.
// Only includes folder types that belong to inFolder parent types.
const FOLDER_TYPE_IDS = new Set(
  Object.values(registry.types)
    .filter(t => t.inFolder && t.folderType)
    .map(t => t.folderType as string)
)

// Types that need content array (Dashboard, Report, EmailTemplate but NOT Document)
// Document in v66.ts has just suffix, no content array
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

export class SDRMetadataAdapter {
  public static async getLatestApiVersion(): Promise<string> {
    const version = await getCurrentApiVersion()
    return version.toString()
  }

  public static toInternalMetadata(): Metadata[] {
    const result: Metadata[] = []

    for (const sdrType of Object.values(registry.types)) {
      // Skip folder types - they're included via parent's content array
      if (FOLDER_TYPE_IDS.has(sdrType.id)) {
        continue
      }

      result.push(SDRMetadataAdapter.convertType(sdrType))

      // Add child types if present
      if (sdrType.children?.types) {
        const childDirectoryNames = new Set(
          Object.keys(sdrType.children.directories ?? {})
        )

        for (const childType of Object.values(sdrType.children.types)) {
          const child = childType as SDRChildType
          const childDirName = SDRMetadataAdapter.findChildDirectory(
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
            SDRMetadataAdapter.convertChildType(
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

    return result
  }

  // Finds the child's directory name by matching its xmlElementName against
  // the keys in the parent's children.directories map.
  private static findChildDirectory(
    child: SDRChildType,
    directoryNames: Set<string>
  ): string {
    if (child.xmlElementName && directoryNames.has(child.xmlElementName)) {
      return child.xmlElementName
    }
    return child.directoryName ?? ''
  }

  private static convertType(sdrType: SDRMetadataType): Metadata {
    // Build content array for types that need it (Dashboard, Report, EmailTemplate)
    const needsContent = TYPES_WITH_CONTENT_ARRAY.has(sdrType.id)
    let content: SharedFolderMetadata[] | undefined

    if (needsContent && sdrType.folderType) {
      const folderType = registry.types[sdrType.folderType]
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
      metaFile: SDRMetadataAdapter.hasMetaFile(sdrType),
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

  private static convertChildType(
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

  private static hasMetaFile(sdrType: SDRMetadataType): boolean {
    const adapter = sdrType.strategies?.adapter
    return adapter ? CONTENT_FILE_ADAPTERS.has(adapter) : false
  }
}
