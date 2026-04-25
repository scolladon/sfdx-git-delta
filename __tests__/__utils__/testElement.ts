'use strict'
import { parse } from 'node:path/posix'

import { ADDITION, GIT_DIFF_TYPE_REGEX } from '../../src/constant/gitConstants'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository'
import type { Metadata } from '../../src/types/metadata'
import { MetadataElement } from '../../src/utils/metadataElement'

export const createElement = (
  line: string,
  metadataDef: Metadata,
  globalMetadata: MetadataRepository
): { changeType: string; element: MetadataElement } => {
  // Tolerate bare-path inputs (legacy test ergonomics): if the line has the
  // production "<char><whitespace><path>" shape we keep the literal status
  // char (so tests can exercise unknown / invalid types like 'Z'); a bare
  // path defaults to ADDITION so the resulting element has a well-formed
  // changeKind for downstream ChangeSet inserts.
  const hasPrefix = /\s/.test(line.charAt(1))
  const changeType = (hasPrefix ? line.charAt(0) : ADDITION) as string
  const path = hasPrefix ? line.replace(GIT_DIFF_TYPE_REGEX, '') : line

  const element =
    MetadataElement.fromPath(path, metadataDef, globalMetadata) ??
    MetadataElement.fromScan(
      path,
      metadataDef,
      globalMetadata,
      parse(path).name
    )

  return { changeType, element }
}
