'use strict'
import { GIT_DIFF_TYPE_REGEX } from '../../src/constant/gitConstants'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository'
import type { Metadata } from '../../src/types/metadata'
import { MetadataElement } from '../../src/utils/metadataElement'

export const createElement = (
  line: string,
  metadataDef: Metadata,
  globalMetadata: MetadataRepository
): { changeType: string; element: MetadataElement } => {
  const changeType = line.charAt(0) as string
  const path = line.replace(GIT_DIFF_TYPE_REGEX, '')

  const element =
    MetadataElement.fromPath(path, metadataDef, globalMetadata) ??
    MetadataElement.fromScan(
      path,
      metadataDef,
      globalMetadata,
      path.split('/').length - 1
    )

  return { changeType, element }
}
