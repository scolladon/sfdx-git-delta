'use strict'

import type { TreeReader } from '../adapter/treeReader.js'
import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import type {
  CopyOperation,
  GitCopyOperation,
  GitTypeDirCompanionCopyOperation,
} from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'

export type WithoutCompanionRequests = Exclude<
  CopyOperation,
  GitTypeDirCompanionCopyOperation
>

// SDR's METADATA_XML_REGEX, verbatim and unanchored like SDR's: for
// suffix-less bundle types SDR takes a folder's root metadata to be a direct
// entry whose first-dot stem is the folder name and that matches this.
const ROOT_METADATA_XML = /(.+)\.(.+)-meta\.xml/
// NUL cannot occur in a git path or a ref
const KEY_SEPARATOR = '\0'

const isRootMetadataOf =
  (name: string) =>
  (entry: string): boolean =>
    entry.split(DOT)[0] === name && ROOT_METADATA_XML.test(entry)

const isBundle = (entries: readonly string[], name: string): boolean =>
  entries.some(isRootMetadataOf(name))

// A file has no children, so it is never a bundle and filesUnder returns it.
const companionFilesOf =
  (trees: TreeReader, { revision, path }: GitTypeDirCompanionCopyOperation) =>
  (name: string): string[] => {
    const entry = `${path}${PATH_SEP}${name}`
    if (isBundle(trees.children(revision, entry), name)) return []
    return trees.filesUnder(revision, entry)
  }

const companionCopiesOf = (
  trees: TreeReader,
  request: GitTypeDirCompanionCopyOperation
): GitCopyOperation[] =>
  trees
    .children(request.revision, request.path)
    .flatMap(companionFilesOf(trees, request))
    .map(path => ({
      kind: CopyOperationKind.GitCopy,
      path,
      revision: request.revision,
    }))

const requestKey = ({
  revision,
  path,
}: GitTypeDirCompanionCopyOperation): string =>
  `${revision}${KEY_SEPARATOR}${path}`

export const expandTypeDirCompanionCopies = (
  copies: readonly CopyOperation[],
  trees: TreeReader
): WithoutCompanionRequests[] => {
  const seen = new Set<string>()
  return copies.flatMap(op => {
    if (op.kind !== CopyOperationKind.GitTypeDirCompanionCopy) return [op]
    const key = requestKey(op)
    if (seen.has(key)) return []
    seen.add(key)
    return companionCopiesOf(trees, op)
  })
}
