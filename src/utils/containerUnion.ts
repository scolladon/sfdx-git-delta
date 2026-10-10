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

const inScopeOf = (input: UnionSpecInput): ((path: string) => boolean) => {
  if (input.scope === LABELS_UNION_SCOPE) {
    return path =>
      path.endsWith(LABELS_FILE_SUFFIX) &&
      isLabelsContainer(path, input.metadata)
  }
  const inRoots = buildScopeMatcher(input.listingRoots)
  return path =>
    inRoots(path) && unionScopeOf(path, input.metadata) === input.scope
}

const candidates = (
  input: UnionSpecInput,
  side: RevisionSide
): readonly string[] => {
  const inSource = buildScopeMatcher(input.source)
  const inScope = inScopeOf(input)
  return [...side.blobIds.keys()]
    .filter(
      path =>
        inSource(path) &&
        input.metadata.has(path) &&
        inScope(path) &&
        side.project.packageDirectoryOf(path) === input.entry
    )
    .sort()
}

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

export const buildUnionSpec = (input: UnionSpecInput): UnionSpec => {
  const fromPaths = candidates(input, input.from).filter(path =>
    staysInEntry(input, path)
  )
  const additionBase = fromPaths.filter(path =>
    vouchesForAdditions(input, path)
  )
  const deletionBase = fromPaths.filter(path =>
    vouchesForDeletions(input, path)
  )
  const shields = candidates(input, input.to)
  const emitted = emitting(input.lines)
  const inDeletionBase = new Set(deletionBase)
  return {
    entry: input.entry,
    additionBasePaths: additionBase,
    deletionBasePaths: deletionBase,
    shieldPaths: shields,
    memberPaths: shields.filter(path => emitted.has(path)),
    droppedDeletions: input.lines.filter(
      line => line.charAt(0) === DELETION && inDeletionBase.has(pathOf(line))
    ),
  }
}
