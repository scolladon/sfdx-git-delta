'use strict'
import type { Writable } from 'node:stream'

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

// Handlers and collectors emit a HandlerResult describing only what they
// themselves contributed: a flat, readonly sequence of manifest elements,
// never a container shared with anyone else (ADR 001). `ChangeSet.from`
// is the single construction path that folds this wire format into the
// indexed read model consumed downstream by forPackageManifest /
// forDestructiveManifest.
export type HandlerResult = Readonly<{
  elements: readonly ManifestElement[]
  copies: readonly CopyOperation[]
  warnings: readonly Error[]
}>

export const emptyResult = (): HandlerResult => ({
  elements: [],
  copies: [],
  warnings: [],
})

export const mergeResults = (
  ...results: readonly HandlerResult[]
): HandlerResult => ({
  elements: results.flatMap(r => r.elements),
  copies: results.flatMap(r => r.copies),
  warnings: results.flatMap(r => r.warnings),
})
