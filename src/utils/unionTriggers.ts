'use strict'
import {
  isKept,
  listingRoots,
  type MoveEnv,
  type MoveGroup,
  movedPathsOf,
  type Probe,
  probesOf,
} from './componentMove.js'
import { unionScopeOf } from './containerUnion.js'
import { groupByEntry, type RevisionView } from './revisionSide.js'
import type { PackageDirectoryKey } from './sfdxProject.js'

export type UnionTrigger = Readonly<{
  scope: string
  entry: PackageDirectoryKey
  roots: readonly string[]
}>

export type UnionTarget = Readonly<{
  scope: string
  entry: PackageDirectoryKey
  listingRoots: readonly string[]
}>

export const triggersOf = (
  group: MoveGroup,
  probes: ReadonlyMap<string, Probe>,
  view: RevisionView,
  env: MoveEnv
): readonly UnionTrigger[] => {
  const known = probesOf(group, probes)
  if (!known?.some(probe => probe.comparesElements)) return []
  const { deletions, additions } = movedPathsOf(group)
  const [first] = deletions
  if (first === undefined) return []
  const scope = unionScopeOf(first, env.metadata)
  const added = groupByEntry(additions, view.to)
  const visible = deletions.filter(path => isKept(path, env.ignore))
  return [...groupByEntry(visible, view.from)].flatMap(([entry, old]) => {
    const arrived = added.get(entry)
    const roots =
      arrived &&
      listingRoots({ deletions: old, additions: arrived }, env.metadata)
    return roots ? [{ scope, entry, roots }] : []
  })
}

export const toUnionTargets = (
  triggers: readonly UnionTrigger[]
): readonly UnionTarget[] => {
  const merged = new Map<string, Map<PackageDirectoryKey, Set<string>>>()
  for (const { scope, entry, roots } of triggers) {
    const entries =
      merged.get(scope) ?? new Map<PackageDirectoryKey, Set<string>>()
    const known = entries.get(entry) ?? new Set<string>()
    for (const root of roots) known.add(root)
    merged.set(scope, entries.set(entry, known))
  }
  return [...merged].flatMap(([scope, entries]) =>
    [...entries].map(([entry, roots]) => ({
      scope,
      entry,
      listingRoots: [...roots].sort(),
    }))
  )
}
