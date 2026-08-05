'use strict'
import { DOT } from '../constant/fsConstants.js'
import {
  DIGITAL_EXPERIENCE_BUNDLE_TYPE,
  DIGITAL_EXPERIENCE_TYPE,
} from '../constant/metadataConstants.js'
import type { ManifestElement } from '../types/handlerResult.js'
import { ManifestTarget } from '../types/handlerResult.js'
import { MessageService } from './MessageService.js'

export type BundleRollupOutcome = Readonly<{
  keptElements: readonly ManifestElement[]
  warnings: readonly Error[]
}>

// Generic shape (one concrete pair today): a parent metadata type whose
// member subsumes every child of the same site/bundle in the deploy contract.
// For DigitalExperienceBundle → DigitalExperience, a DEB member deploys (or
// deletes) every DE child, so DE entries covered by a same-manifest DEB are
// redundant. This filter collapses them per manifest and — because a
// whole-bundle deletion is org-gated — warns when a DEB lands in
// destructiveChanges. When a second parent/child pair appears, generalize to
// a config list of (parentType, childType, parentMemberOf) triples; until
// then the implementation stays focused on the only pair we have empirical
// deploy semantics for.
export const applyBundleRollup = (
  elements: readonly ManifestElement[]
): BundleRollupOutcome => {
  const bundleMembersByTarget = collectBundleMembers(elements)
  const keptElements = elements.filter(
    element =>
      !(
        element.type === DIGITAL_EXPERIENCE_TYPE &&
        isCoveredByBundle(element, bundleMembersByTarget)
      )
  )
  const warnings = warnBundleDeletions(
    bundleMembersByTarget.get(ManifestTarget.DestructiveChanges)
  )
  return { keptElements, warnings }
}

const collectBundleMembers = (
  elements: readonly ManifestElement[]
): Map<ManifestTarget, Set<string>> => {
  const bundleMembersByTarget = new Map<ManifestTarget, Set<string>>()
  for (const { target, type, member } of elements) {
    if (type !== DIGITAL_EXPERIENCE_BUNDLE_TYPE) continue
    let members = bundleMembersByTarget.get(target)
    if (!members) {
      members = new Set()
      bundleMembersByTarget.set(target, members)
    }
    members.add(member)
  }
  return bundleMembersByTarget
}

const isCoveredByBundle = (
  element: ManifestElement,
  bundleMembersByTarget: Map<ManifestTarget, Set<string>>
): boolean => {
  const bundleMembers = bundleMembersByTarget.get(element.target)
  if (!bundleMembers) return false
  // A canonical `DigitalExperience` member is `<base>/<space>.<ct>/<cn>` and
  // `<space>` (a Salesforce API name) cannot contain `.`, so the first `.`
  // delimits the parent bundle's member exactly. One Set lookup vs. an
  // `O(B)` linear `startsWith` scan over `bundleMembers`.
  const dotIdx = element.member.indexOf(DOT)
  if (dotIdx < 0) return false
  return bundleMembers.has(element.member.slice(0, dotIdx))
}

const warnBundleDeletions = (
  bundleMembers: Set<string> | undefined
): readonly Error[] => {
  if (!bundleMembers) return []
  const message = new MessageService()
  const warnings: Error[] = []
  for (const bundleMember of bundleMembers) {
    warnings.push(
      new Error(
        message.getMessage('warning.DigitalExperienceBundleDeletion', [
          bundleMember,
        ])
      )
    )
  }
  return warnings
}
