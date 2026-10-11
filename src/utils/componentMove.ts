'use strict'
import { dirname } from 'node:path'

import type { ObjectId } from '@scolladon/tsgit'

import { buildScopeMatcher } from '../adapter/pathMatching.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import { comparisonName } from './comparisonName.js'
import { additionLineOf, pathOfLine } from './gitLine.js'
import type { IgnoreHelper } from './ignoreHelper.js'
import {
  type BlobIds,
  entryOf,
  groupBy,
  type RevisionView,
} from './revisionSide.js'
import { componentListingRoot } from './treeIndexScope.js'

export type Probe = Readonly<{
  type: string
  member: string
  comparesElements: boolean
}>

export type MoveGroup = Readonly<{
  name: string
  deletions: readonly string[]
  additions: readonly string[]
}>

export type MovedPaths = Pick<MoveGroup, 'deletions' | 'additions'>

export type Candidate = Readonly<{
  moved: MovedPaths
  roots: readonly string[]
  label: string
}>

export type MoveEnv = Readonly<{
  metadata: MetadataRepository
  source: readonly string[]
  ignore: Pick<IgnoreHelper, 'keep'>
}>

type ComponentIndex = ReadonlyMap<string, readonly string[]>

export type ComponentIndexes = Readonly<{
  from: ComponentIndex
  to: ComponentIndex
}>

type Identity = Pick<Probe, 'type' | 'member'>

export const NO_COMPONENTS: ComponentIndexes = {
  from: new Map(),
  to: new Map(),
}

export const movedPathsOf = (group: MoveGroup): MovedPaths => ({
  deletions: group.deletions.map(pathOfLine),
  additions: group.additions.map(pathOfLine),
})

export const probesOf = (
  group: MoveGroup,
  probes: ReadonlyMap<string, Probe>
): readonly Probe[] | undefined => {
  const found: Probe[] = []
  for (const line of [...group.deletions, ...group.additions]) {
    const probe = probes.get(line)
    if (!probe) return undefined
    found.push(probe)
  }
  return found
}

export const isKept = (
  path: string,
  ignore: Pick<IgnoreHelper, 'keep'>
): boolean => ignore.keep(additionLineOf(path))

export const listingRoots = (
  moved: MovedPaths,
  metadata: MetadataRepository
): readonly string[] | undefined => {
  const roots: string[] = []
  for (const path of [...moved.deletions, ...moved.additions]) {
    const root = componentListingRoot(path, metadata)
    if (root === null) return undefined
    roots.push(root)
  }
  return roots
}

// A shared directory is a leading prefix: segments that merely repeat at the
// same depth under different parents (a/classes, b/classes) are not shared.
const commonDirectory = (paths: readonly string[]): string =>
  paths
    .map(path => dirname(path).split('/'))
    .reduce((shared, segments) => {
      const diverges = shared.findIndex(
        (segment, index) => segments[index] !== segment
      )
      return diverges === -1 ? shared : shared.slice(0, diverges)
    })
    .join('/')

type RelativeSide = Readonly<{
  blobIds: ReadonlyMap<string, ObjectId | undefined>
}>

const NO_DIRECTORY = new Set(['', '.'])

const relativeSide = (
  paths: readonly string[],
  blobIds: BlobIds
): RelativeSide => {
  const root = commonDirectory(paths)
  const skip = NO_DIRECTORY.has(root) ? 0 : root.length + 1
  const byRelative = new Map<string, ObjectId | undefined>()
  for (const path of paths) byRelative.set(path.slice(skip), blobIds.get(path))
  return { blobIds: byRelative }
}

const sharedIdentity = (probes: readonly Probe[]): Identity | undefined => {
  const [first, ...rest] = probes
  if (!first) return undefined
  const { type, member } = first
  const shared = rest.every(
    probe => probe.type === type && probe.member === member
  )
  return shared ? { type, member } : undefined
}

const entryCount = (moved: MovedPaths, view: RevisionView): number =>
  new Set([
    ...moved.deletions.map(path => entryOf(view.from, path)),
    ...moved.additions.map(path => entryOf(view.to, path)),
  ]).size

const sameEntry = (moved: MovedPaths, view: RevisionView): boolean =>
  entryCount(moved, view) === 1

export const spansEntries = (group: MoveGroup, view: RevisionView): boolean =>
  entryCount(movedPathsOf(group), view) > 1

const sameSet = (
  found: readonly string[],
  expected: readonly string[]
): boolean => {
  const wanted = new Set(expected)
  return found.length === wanted.size && found.every(path => wanted.has(path))
}

const sameContent = (moved: MovedPaths, view: RevisionView): boolean => {
  const before = relativeSide(moved.deletions, view.from.blobIds)
  const after = relativeSide(moved.additions, view.to.blobIds)
  return (
    before.blobIds.size === after.blobIds.size &&
    [...before.blobIds].every(
      ([path, id]) => id !== undefined && id === after.blobIds.get(path)
    )
  )
}

const isComplete = (
  name: string,
  { moved, roots }: Candidate,
  indexes: ComponentIndexes
): boolean => {
  const inRoots = buildScopeMatcher(roots)
  const listed = (index: ComponentIndex): readonly string[] =>
    (index.get(name) ?? []).filter(inRoots)
  return (
    sameSet(listed(indexes.from), moved.deletions) &&
    sameSet(listed(indexes.to), moved.additions)
  )
}

export const isPure = (
  name: string,
  candidate: Candidate,
  view: RevisionView,
  indexes: ComponentIndexes
): boolean =>
  isComplete(name, candidate, indexes) && sameContent(candidate.moved, view)

export const candidateOf = (
  group: MoveGroup,
  probes: ReadonlyMap<string, Probe>,
  view: RevisionView,
  env: MoveEnv
): Candidate | undefined => {
  const known = probesOf(group, probes)
  if (!known || known.some(probe => probe.comparesElements)) return undefined
  const identity = sharedIdentity(known)
  if (!identity) return undefined
  const moved = movedPathsOf(group)
  if (!moved.deletions.every(path => isKept(path, env.ignore))) {
    return undefined
  }
  if (!sameEntry(moved, view)) return undefined
  const roots = listingRoots(moved, env.metadata)
  const label = `${identity.type}:${identity.member}`
  return roots ? { moved, roots, label } : undefined
}

type SideScope = Readonly<{
  inSource: (path: string) => boolean
  inCandidateRoots: (path: string) => boolean
}>

const indexSide = (
  blobIds: BlobIds,
  env: MoveEnv,
  scope: SideScope
): ComponentIndex => {
  const isIndexed = (path: string): boolean => {
    const line = additionLineOf(path)
    return (
      scope.inSource(path) && env.metadata.has(line) && env.ignore.keep(line)
    )
  }
  const paths = [...blobIds.keys()]
    .filter(scope.inCandidateRoots)
    .filter(isIndexed)
  return groupBy(paths, path =>
    comparisonName(env.metadata, additionLineOf(path))
  )
}

export const indexComponents = (
  candidates: readonly Candidate[],
  view: RevisionView,
  env: MoveEnv
): ComponentIndexes => {
  if (candidates.length === 0) return NO_COMPONENTS
  const scope: SideScope = {
    inSource: buildScopeMatcher(env.source),
    inCandidateRoots: buildScopeMatcher(
      candidates.flatMap(candidate => candidate.roots)
    ),
  }
  return {
    from: indexSide(view.from.blobIds, env, scope),
    to: indexSide(view.to.blobIds, env, scope),
  }
}
