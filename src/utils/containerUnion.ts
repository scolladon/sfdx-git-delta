'use strict'
import { basename, extname } from 'node:path/posix'

import { buildScopeMatcher } from '../adapter/pathMatching.js'
import { ADDITION, DELETION, MODIFICATION } from '../constant/gitConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import { comparisonName } from './comparisonName.js'
import { additionLineOf, lineOf, pathOfLine } from './gitLine.js'
import type { IgnoreHelper } from './ignoreHelper.js'
import type { UnionDiffInput } from './metadataDiff/index.js'
import {
  entryOf,
  groupBy,
  groupByEntry,
  type RevisionSide,
} from './revisionSide.js'
import type { PackageDirectoryKey } from './sfdxProject.js'

export const LABELS_UNION_SCOPE = 'CustomLabels'

const LABELS_XML_NAME = 'CustomLabel'
const LABELS_EXTENSION = 'labels'

const LABELS_FILE_EXTENSION = `.${LABELS_EXTENSION}`

const extensionOf = (path: string): string =>
  extname(basename(path).replace(METAFILE_SUFFIX, ''))

export const isLabelsContainer = (
  path: string,
  metadata: MetadataRepository
): boolean =>
  metadata.get(path)?.xmlName === LABELS_XML_NAME &&
  extensionOf(path) === LABELS_FILE_EXTENSION

export const unionScopeOf = (
  path: string,
  metadata: MetadataRepository
): string =>
  isLabelsContainer(path, metadata)
    ? LABELS_UNION_SCOPE
    : comparisonName(metadata, additionLineOf(path))

const LABELS_FILE_SUFFIX = `.${LABELS_EXTENSION}${METAFILE_SUFFIX}`

export type UnionSpec = UnionDiffInput &
  Readonly<{ droppedDeletions: readonly string[] }>

export type UnionSpecInput = Readonly<{
  scope: string
  entry: PackageDirectoryKey
  listingRoots: readonly string[]
  metadata: MetadataRepository
  source: readonly string[]
  ignore: Pick<IgnoreHelper, 'keep'>
  from: RevisionSide
  to: RevisionSide
  lines: readonly string[]
}>

type ListingTarget = Pick<UnionSpecInput, 'scope' | 'listingRoots'>

type ListingInput = Pick<
  UnionSpecInput,
  'metadata' | 'source' | 'from' | 'to' | 'lines'
>

type DeletionLine = Readonly<{ line: string; position: number }>

type ListedSideEntries = ReadonlyMap<PackageDirectoryKey, readonly string[]>

type ListedSide = ReadonlyMap<string, ListedSideEntries>

export type UnionListing = Readonly<{
  from: ListedSide
  to: ListedSide
  emitted: ReadonlySet<string>
  deletions: ReadonlyMap<string, readonly DeletionLine[]>
}>

const isLabelsFile = (path: string): boolean =>
  path.endsWith(LABELS_FILE_SUFFIX)

const listSide = (
  input: ListingInput,
  side: RevisionSide,
  targets: readonly ListingTarget[]
): ListedSide => {
  const inSource = buildScopeMatcher(input.source)
  const inAnyRoots = buildScopeMatcher(
    targets.flatMap(target => target.listingRoots)
  )
  const isListed = (path: string): boolean =>
    inSource(path) &&
    (isLabelsFile(path) || inAnyRoots(path)) &&
    input.metadata.has(path)
  const byScope = groupBy([...side.blobIds.keys()].filter(isListed), path =>
    unionScopeOf(path, input.metadata)
  )
  return new Map(
    [...byScope].map(([scope, paths]): [string, ListedSideEntries] => [
      scope,
      groupByEntry(paths, side),
    ])
  )
}

const deletionLines = (
  lines: readonly string[]
): ReadonlyMap<string, readonly DeletionLine[]> => {
  const found = new Map<string, DeletionLine[]>()
  lines.forEach((line, position) => {
    if (line.charAt(0) !== DELETION) return
    const path = pathOfLine(line)
    const same = found.get(path) ?? []
    same.push({ line, position })
    found.set(path, same)
  })
  return found
}

export const listUnionCandidates = (
  input: ListingInput,
  targets: readonly ListingTarget[]
): UnionListing => ({
  from: listSide(input, input.from, targets),
  to: listSide(input, input.to, targets),
  emitted: emitting(input.lines),
  deletions: deletionLines(input.lines),
})

const inScopeOf = (input: UnionSpecInput): ((path: string) => boolean) => {
  if (input.scope === LABELS_UNION_SCOPE) return isLabelsFile
  return buildScopeMatcher(input.listingRoots)
}

const candidates = (
  input: UnionSpecInput,
  buckets: ListedSide
): readonly string[] =>
  (buckets.get(input.scope)?.get(input.entry) ?? [])
    .filter(inScopeOf(input))
    .sort()

const keeps = (
  ignore: Pick<IgnoreHelper, 'keep'>,
  type: string,
  path: string
): boolean => ignore.keep(lineOf(type, path))

const staysInEntry = (input: UnionSpecInput, path: string): boolean =>
  !input.to.blobIds.has(path) || entryOf(input.to, path) === input.entry

// A deleted file under the destructive ignore cannot vouch for additions.
const vouchesForAdditions = (input: UnionSpecInput, path: string): boolean =>
  keeps(input.ignore, ADDITION, path) &&
  (input.to.blobIds.has(path) || keeps(input.ignore, DELETION, path))

const vouchesForDeletions = (input: UnionSpecInput, path: string): boolean =>
  keeps(input.ignore, ADDITION, path) && keeps(input.ignore, DELETION, path)

const emitting = (lines: readonly string[]): ReadonlySet<string> =>
  new Set(
    lines
      .filter(line => [ADDITION, MODIFICATION].includes(line.charAt(0)))
      .map(pathOfLine)
  )

const droppedDeletionsOf = (
  deletionBase: readonly string[],
  listing: UnionListing
): readonly string[] =>
  deletionBase
    .flatMap(path => listing.deletions.get(path) ?? [])
    .sort((a, b) => a.position - b.position)
    .map(({ line }) => line)

export const buildUnionSpec = (
  input: UnionSpecInput,
  listing: UnionListing
): UnionSpec => {
  const fromPaths = candidates(input, listing.from).filter(path =>
    staysInEntry(input, path)
  )
  const deletionBase = fromPaths.filter(path =>
    vouchesForDeletions(input, path)
  )
  const shields = candidates(input, listing.to)
  return {
    additionBasePaths: fromPaths.filter(path =>
      vouchesForAdditions(input, path)
    ),
    deletionBasePaths: deletionBase,
    shieldPaths: shields,
    memberPaths: shields.filter(path => listing.emitted.has(path)),
    droppedDeletions: droppedDeletionsOf(deletionBase, listing),
  }
}
