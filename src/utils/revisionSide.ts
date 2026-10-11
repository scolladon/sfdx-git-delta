'use strict'
import type { ObjectId } from '@scolladon/tsgit'

import type { PackageDirectoryKey, SfdxProject } from './sfdxProject.js'

export type BlobIds = ReadonlyMap<string, ObjectId>

export type RevisionSide = Readonly<{
  project: SfdxProject
  blobIds: BlobIds
}>

export type RevisionView = Readonly<{ from: RevisionSide; to: RevisionSide }>

export const entryOf = (
  side: RevisionSide,
  path: string
): PackageDirectoryKey => side.project.packageDirectoryOf(path)

export const groupBy = <K>(
  paths: readonly string[],
  keyOf: (path: string) => K
): ReadonlyMap<K, readonly string[]> => {
  const grouped = new Map<K, string[]>()
  for (const path of paths) {
    const key = keyOf(path)
    const bucket = grouped.get(key) ?? []
    bucket.push(path)
    grouped.set(key, bucket)
  }
  return grouped
}

export const groupByEntry = (
  paths: readonly string[],
  side: RevisionSide
): ReadonlyMap<PackageDirectoryKey, readonly string[]> =>
  groupBy(paths, path => entryOf(side, path))
