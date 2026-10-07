'use strict'
import {
  type CopyOperation,
  type HandlerResult,
  type ManifestElement,
  ManifestTarget,
  mergeResults,
} from '../types/handlerResult.js'
import { applyBundleRollup } from './bundleRollup.js'
import ChangeSet, { type RenameTriple } from './changeSet.js'

export type ChangesAssemblyResult = Readonly<{
  changes: ChangeSet
  copies: readonly CopyOperation[]
  warnings: readonly Error[]
}>

type MemberIndex = ReadonlyMap<string, ReadonlySet<string>>

const indexMembers = (
  elements: readonly ManifestElement[],
  target: ManifestTarget
): MemberIndex => {
  const index = new Map<string, Set<string>>()
  for (const element of elements) {
    if (element.target !== target) continue
    const members = index.get(element.type) ?? new Set<string>()
    members.add(element.member)
    index.set(element.type, members)
  }
  return index
}

const hasMember = (index: MemberIndex, type: string, member: string): boolean =>
  index.get(type)?.has(member) ?? false

// A rename may only relabel what the passes emitted: a triple whose sides
// they did not emit would inject members a default run never produces.
const corroboratedRenames = (
  elements: readonly ManifestElement[],
  triples: readonly RenameTriple[]
): readonly RenameTriple[] => {
  const packaged = indexMembers(elements, ManifestTarget.Package)
  const deleted = indexMembers(elements, ManifestTarget.DestructiveChanges)
  return triples.filter(
    ({ type, from, to }) =>
      hasMember(packaged, type, to) &&
      (hasMember(packaged, type, from) || hasMember(deleted, type, from))
  )
}

// Folds the handler pass and collector output into the single indexed read
// model consumed downstream. Renames are corroborated against keptElements,
// after the bundle roll-up, so neither xml manifest changes with or without
// rename detection; reading any earlier set would let a triple re-add a
// member the roll-up dropped.
export const assembleChanges = (
  handlerResult: HandlerResult,
  postResult: HandlerResult,
  renameTriples: readonly RenameTriple[]
): ChangesAssemblyResult => {
  const combinedResult = mergeResults(handlerResult, postResult)
  const { keptElements, warnings: rollupWarnings } = applyBundleRollup(
    combinedResult.elements
  )
  const changes = ChangeSet.from(
    keptElements,
    corroboratedRenames(keptElements, renameTriples)
  ) // built exactly once

  return {
    changes,
    copies: combinedResult.copies,
    warnings: [...combinedResult.warnings, ...rollupWarnings],
  }
}
