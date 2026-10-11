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

type FilesByComponent = Map<string, string[]>

type Requests = Readonly<{
  byRevision: Map<string, FilesByComponent>
  filesByFirstOccurrence: Map<number, string[]>
}>

const NOT_FOUND = -1
const COMPONENT_NAME_END = /[./]/

const parentOf = (path: string): string =>
  path.substring(0, path.lastIndexOf(PATH_SEP))

const addRequest = (
  { byRevision, filesByFirstOccurrence }: Requests,
  { revision, path }: GitComponentCopyOperation,
  index: number
): void => {
  const owned = byRevision.get(revision) ?? new Map<string, string[]>()
  byRevision.set(revision, owned)
  if (owned.has(path)) return
  const files: string[] = []
  owned.set(path, files)
  filesByFirstOccurrence.set(index, files)
}

const collectRequests = (copies: readonly CopyOperation[]): Requests => {
  const requests: Requests = {
    byRevision: new Map(),
    filesByFirstOccurrence: new Map(),
  }
  for (const [index, op] of copies.entries()) {
    if (op.kind === CopyOperationKind.GitComponentCopy) {
      addRequest(requests, op, index)
    }
  }
  return requests
}

const nextCut = (file: string, from: number): number => {
  const offset = file.slice(from).search(COMPONENT_NAME_END)
  return offset === NOT_FOUND ? NOT_FOUND : from + offset
}

const assignCuts = (
  owned: FilesByComponent,
  file: string,
  from: number
): void => {
  let cut = nextCut(file, from)
  while (cut !== NOT_FOUND) {
    owned.get(file.slice(0, cut))?.push(file)
    if (file[cut] !== DOT) return
    cut = nextCut(file, cut + DOT.length)
  }
}

const assignListing = (
  trees: TreeReader,
  revision: string,
  parent: string,
  owned: FilesByComponent
): void => {
  // At the root listing (empty parent) this starts one character in, which
  // only skips a leading dot whose cut would be the empty path.
  const nameStart = parent.length + PATH_SEP.length
  for (const file of trees.filesUnder(revision, parent)) {
    assignCuts(owned, file, nameStart)
  }
}

const listEachParentOnce = (
  trees: TreeReader,
  revision: string,
  owned: FilesByComponent
): void => {
  const parents = new Set(Array.from(owned.keys(), parentOf))
  for (const parent of parents) assignListing(trees, revision, parent, owned)
}

const filesAt = (
  { filesByFirstOccurrence }: Requests,
  index: number
): string[] => filesByFirstOccurrence.get(index) ?? []

const gitCopyOf = (path: string, revision: string): FileCopyOperation => ({
  kind: CopyOperationKind.GitCopy,
  path,
  revision,
})

export const expandComponentCopies = (
  copies: readonly CopyOperation[],
  trees: TreeReader
): FileCopyOperation[] => {
  const requests = collectRequests(copies)
  for (const [revision, owned] of requests.byRevision) {
    listEachParentOnce(trees, revision, owned)
  }
  return copies.flatMap((op, index) => {
    if (op.kind !== CopyOperationKind.GitComponentCopy) return [op]
    return filesAt(requests, index).map(path => gitCopyOf(path, op.revision))
  })
}
