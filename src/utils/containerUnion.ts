'use strict'
import { basename } from 'node:path/posix'

import { buildScopeMatcher } from '../adapter/pathMatching.js'
import { TAB } from '../constant/cliConstants.js'
import { DOT } from '../constant/fsConstants.js'
import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} from '../constant/gitConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import { comparisonName } from './comparisonName.js'
import type { IgnoreHelper } from './ignoreHelper.js'
import type { UnionDiffInput } from './metadataDiff/index.js'
import type { PackageDirectoryKey, SfdxProject } from './sfdxProject.js'

export const LABELS_UNION_SCOPE = 'CustomLabels'

const LABELS_XML_NAME = 'CustomLabel'
const LABELS_EXTENSION = 'labels'

const extensionOf = (path: string): string =>
  basename(path).replace(METAFILE_SUFFIX, '').split(DOT).pop() as string

export const isLabelsContainer = (
  path: string,
  metadata: MetadataRepository
): boolean =>
  metadata.get(path)?.xmlName === LABELS_XML_NAME &&
  extensionOf(path) === LABELS_EXTENSION

export const unionScopeOf = (
  path: string,
  metadata: MetadataRepository
): string =>
  isLabelsContainer(path, metadata)
    ? LABELS_UNION_SCOPE
    : comparisonName(metadata, `${ADDITION}${TAB}${path}`)

const LABELS_FILE_SUFFIX = `.${LABELS_EXTENSION}${METAFILE_SUFFIX}`

export type RevisionSide = Readonly<{
  project: SfdxProject
  blobIds: ReadonlyMap<string, unknown>
}>

export type UnionSpec = UnionDiffInput &
  Readonly<{ entry: PackageDirectoryKey; droppedDeletions: readonly string[] }>

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

const pathOf = (line: string): string => line.replace(GIT_DIFF_TYPE_REGEX, '')

type ListingTarget = Pick<UnionSpecInput, 'scope' | 'listingRoots'>

type ListingInput = Pick<
  UnionSpecInput,
  'metadata' | 'source' | 'from' | 'to' | 'lines'
>

type Buckets = Map<string, Map<PackageDirectoryKey, string[]>>

type DeletionLine = Readonly<{ line: string; position: number }>

type ListedSide = ReadonlyMap<
  string,
  ReadonlyMap<PackageDirectoryKey, readonly string[]>
>

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
): Buckets => {
  const inSource = buildScopeMatcher(input.source)
  const inAnyRoots = buildScopeMatcher(
    targets.flatMap(target => target.listingRoots)
  )
  const buckets: Buckets = new Map()
  for (const path of side.blobIds.keys()) {
    if (!inSource(path) || !(isLabelsFile(path) || inAnyRoots(path))) continue
    if (!input.metadata.has(path)) continue
    const scope = unionScopeOf(path, input.metadata)
    const entries = buckets.get(scope) ?? new Map()
    const entry = side.project.packageDirectoryOf(path)
    const paths = entries.get(entry) ?? []
    paths.push(path)
    entries.set(entry, paths)
    buckets.set(scope, entries)
  }
  return buckets
}

const deletionLines = (
  lines: readonly string[]
): ReadonlyMap<string, readonly DeletionLine[]> => {
  const found = new Map<string, DeletionLine[]>()
  lines.forEach((line, position) => {
    if (line.charAt(0) !== DELETION) return
    const path = pathOf(line)
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
): boolean => ignore.keep(`${type}${TAB}${path}`)

const staysInEntry = (input: UnionSpecInput, path: string): boolean =>
  !input.to.blobIds.has(path) ||
  input.to.project.packageDirectoryOf(path) === input.entry

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
      .map(pathOf)
  )

export const buildUnionSpec = (
  input: UnionSpecInput,
  listing: UnionListing = listUnionCandidates(input, [input])
): UnionSpec => {
  const fromPaths = candidates(input, listing.from).filter(path =>
    staysInEntry(input, path)
  )
  const additionBase = fromPaths.filter(path =>
    vouchesForAdditions(input, path)
  )
  const deletionBase = fromPaths.filter(path =>
    vouchesForDeletions(input, path)
  )
  const shields = candidates(input, listing.to)
  return {
    entry: input.entry,
    additionBasePaths: additionBase,
    deletionBasePaths: deletionBase,
    shieldPaths: shields,
    memberPaths: shields.filter(path => listing.emitted.has(path)),
    droppedDeletions: deletionBase
      .flatMap(path => listing.deletions.get(path) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(({ line }) => line),
  }
}
