'use strict'
import {
  type AddKind,
  ChangeKind,
  type CopyOperation,
  type HandlerResult,
  type ManifestElement,
  ManifestTarget,
} from '../../src/types/handlerResult'
import ChangeSet, { type RenameTriple } from '../../src/utils/changeSet'

// The read-model projection of a handler result. `ChangeSet.from` folds the
// flat element sequence into the indexed read model, and `toElements()`
// orders Package before DestructiveChanges and de-duplicates, which is the
// semantics every migrated assertion was written against.
export const elementsOf = (result: HandlerResult): ManifestElement[] =>
  ChangeSet.from(result.elements).toElements()

export const makeHandlerResult = (parts: {
  manifests?: ManifestElement[]
  copies?: CopyOperation[]
  warnings?: Error[]
}): HandlerResult => ({
  elements: parts.manifests ?? [],
  copies: parts.copies ?? [],
  warnings: parts.warnings ?? [],
})

// `ChangeSet.add` was a test-facing convenience deleted alongside the shared
// sink (ChangeSet.addElement is now private) — this helper reproduces its
// (kind → target) convention so fixtures across the suite keep reading the
// same way.
export const addChange = (
  changes: ChangeSet,
  kind: AddKind,
  type: string,
  member: string
): ChangeSet => {
  const target =
    kind === ChangeKind.Delete
      ? ManifestTarget.DestructiveChanges
      : ManifestTarget.Package
  return ChangeSet.from(
    [...changes.toElements(), { target, type, member, changeKind: kind }],
    renamesOf(changes)
  )
}

// `ChangeSet.recordRename` is private — renames fold in through
// `ChangeSet.from`'s renames parameter — this helper reproduces the old
// mutate-in-place convenience so fixtures across the suite keep reading the
// same way.
export const addRename = (
  changes: ChangeSet,
  type: string,
  from: string,
  to: string
): ChangeSet =>
  ChangeSet.from(changes.toElements(), [
    ...renamesOf(changes),
    { type, from, to },
  ])

// Both helpers rebuild the whole set, so each must carry the other's channel
// forward or interleaving them silently drops one.
const renamesOf = (changes: ChangeSet): RenameTriple[] =>
  [...changes.byChangeKind()[ChangeKind.Rename]].flatMap(
    ([renameType, pairs]) =>
      [...pairs.values()].map(pair => ({ type: renameType, ...pair }))
  )
