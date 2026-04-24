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
  ComputedContent = 'computedContent',
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

export type ComputedContentOperation = {
  kind: CopyOperationKind.ComputedContent
  path: string
  content: string
}

export type StreamedContentOperation = {
  kind: CopyOperationKind.StreamedContent
  path: string
  writer: (out: Writable) => Promise<void>
}

export type CopyOperation =
  | GitCopyOperation
  | GitDirCopyOperation
  | ComputedContentOperation
  | StreamedContentOperation

export type HandlerResult = {
  manifests: ManifestElement[]
  copies: CopyOperation[]
  warnings: Error[]
}

export const emptyResult = (): HandlerResult => ({
  manifests: [],
  copies: [],
  warnings: [],
})

export const mergeResults = (...results: HandlerResult[]): HandlerResult => ({
  manifests: results.flatMap(r => r.manifests),
  copies: results.flatMap(r => r.copies),
  warnings: results.flatMap(r => r.warnings),
})
