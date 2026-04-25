'use strict'
import type { Writable } from 'node:stream'

// Use a type-only import to keep this module purely declarative; the
// runtime constructors emptyResult/mergeResults live in changeSet.ts to
// avoid the circular dep that would arise from a value-side ChangeSet
// import here (changeSet.ts already imports the enums below).
import type ChangeSet from '../utils/changeSet.js'

export enum ManifestTarget {
  Package = 'package',
  DestructiveChanges = 'destructiveChanges',
}

export enum ChangeKind {
  Add = 'add',
  Modify = 'modify',
  Delete = 'delete',
  Rename = 'rename',
}

// Handlers can only produce single-component change kinds — rename carries a
// (from, to) pair that the flat ManifestElement shape can't represent, so it
// is captured separately via ChangeSet.recordRename.
export type AddKind = ChangeKind.Add | ChangeKind.Modify | ChangeKind.Delete

export enum CopyOperationKind {
  GitCopy = 'gitCopy',
  GitDirCopy = 'gitDirCopy',
  StreamedContent = 'streamedContent',
}

export type ManifestElement = {
  target: ManifestTarget
  type: string
  member: string
  changeKind: AddKind
}

export type GitCopyOperation = {
  kind: CopyOperationKind.GitCopy
  path: string
  revision: string
}

export type GitDirCopyOperation = {
  kind: CopyOperationKind.GitDirCopy
  path: string
  revision: string
}

export type StreamedContentOperation = {
  kind: CopyOperationKind.StreamedContent
  path: string
  writer: (out: Writable) => Promise<void>
}

export type CopyOperation =
  | GitCopyOperation
  | GitDirCopyOperation
  | StreamedContentOperation

// Handlers and collectors emit a HandlerResult shaped around a ChangeSet
// instead of a flat ManifestElement[] list. The wire format is now the
// same as the storage format used downstream by ChangeSet.forPackageManifest
// / forDestructiveManifest, removing the dual representation that used to
// live as `manifests: ManifestElement[]` + `work.changes: ChangeSet`.
//
// `emptyResult` and `mergeResults` are exported from changeSet.ts (re-exported
// here for backward compatibility); they live there because they construct
// ChangeSet instances at runtime, which would otherwise cycle through this
// module's enum imports.
export type HandlerResult = {
  changes: ChangeSet
  copies: CopyOperation[]
  warnings: Error[]
}

export { emptyResult, mergeResults } from '../utils/changeSet.js'
