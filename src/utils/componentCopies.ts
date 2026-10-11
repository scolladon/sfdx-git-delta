'use strict'

import type { TreeReader } from '../adapter/treeReader.js'
import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import type {
  CopyOperation,
  GitComponentCopyOperation,
} from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'

export type FileCopyOperation = Exclude<
  CopyOperation,
  GitComponentCopyOperation
>

type ExpandedPaths = Map<string, Set<string>>

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g
const MATCHED_CHAR = '\\$&'

const escapeRegex = (value: string): string =>
  value.replace(REGEX_SPECIAL_CHARS, MATCHED_CHAR)

const parentOf = (path: string): string =>
  path.substring(0, path.lastIndexOf(PATH_SEP))

const isExpanded = (
  expanded: ExpandedPaths,
  { revision, path }: GitComponentCopyOperation
): boolean => expanded.get(revision)?.has(path) ?? false

const markExpanded = (
  expanded: ExpandedPaths,
  { revision, path }: GitComponentCopyOperation
): void => {
  const paths = expanded.get(revision) ?? new Set<string>()
  paths.add(path)
  expanded.set(revision, paths)
}

const componentFiles = (
  trees: TreeReader,
  { revision, path }: GitComponentCopyOperation
): string[] => {
  const belongsToComponent = new RegExp(
    `${escapeRegex(path)}[${PATH_SEP}${DOT}]`
  )
  return trees
    .filesUnder(revision, parentOf(path))
    .filter(file => belongsToComponent.test(file))
}

const gitCopyOf = (path: string, revision: string): FileCopyOperation => ({
  kind: CopyOperationKind.GitCopy,
  path,
  revision,
})

export const expandComponentCopies = (
  copies: readonly CopyOperation[],
  trees: TreeReader
): FileCopyOperation[] => {
  const expanded: ExpandedPaths = new Map()
  return copies.flatMap(op => {
    if (op.kind !== CopyOperationKind.GitComponentCopy) return [op]
    if (isExpanded(expanded, op)) return []
    markExpanded(expanded, op)
    return componentFiles(trees, op).map(path => gitCopyOf(path, op.revision))
  })
}
