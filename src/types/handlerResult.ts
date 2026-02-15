'use strict'

export enum ManifestTarget {
  Package = 'package',
  DestructiveChanges = 'destructiveChanges',
}

export enum CopyOperationKind {
  GitCopy = 'gitCopy',
  ComputedContent = 'computedContent',
}

export type ManifestElement = {
  target: ManifestTarget
  type: string
  member: string
}

export type GitCopyOperation = {
  kind: CopyOperationKind.GitCopy
  path: string
  revision: string
}

export type ComputedContentOperation = {
  kind: CopyOperationKind.ComputedContent
  path: string
  content: string
}

export type CopyOperation = GitCopyOperation | ComputedContentOperation

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
