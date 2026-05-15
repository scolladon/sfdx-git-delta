'use strict'

import { DOT } from '../constant/fsConstants.js'
import {
  DIGITAL_EXPERIENCE_BUNDLE_TYPE,
  DIGITAL_EXPERIENCE_TYPE,
} from '../constant/metadataConstants.js'
import type { ManifestElement } from '../types/handlerResult.js'
import { ManifestTarget } from '../types/handlerResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MessageService } from '../utils/MessageService.js'

import BaseProcessor from './baseProcessor.js'

// Generic shape (one concrete pair today): a parent metadata type whose
// member subsumes every child of the same site/bundle in the deploy contract.
// For DigitalExperienceBundle → DigitalExperience, a DEB member deploys (or
// deletes) every DE child, so DE entries covered by a same-manifest DEB are
// redundant. This processor collapses them per manifest and — because a
// whole-bundle deletion is org-gated — warns when a DEB lands in
// destructiveChanges. When a second parent/child pair appears, generalize to
// a `BundleRollupProcessor` that takes a list of (parentType, childType,
// parentMemberOf) configs; until then we keep the implementation focused on
// the only pair we have empirical deploy semantics for.
export default class BundleRollupProcessor extends BaseProcessor {
  @log
  public override async process(): Promise<void> {
    const elements = this.work.changes.toElements()
    const bundleMembersByTarget = this._collectBundleMembers(elements)

    for (const element of elements) {
      if (
        // Stryker disable next-line ConditionalExpression -- equivalent: flipping the type guard to `true` would also attempt to remove non-DE elements covered by a same-prefix bundle member, but `ChangeSet.removeMember` is a no-op for non-shrinkable types — so the post-process manifest is byte-identical to the original.
        element.type === DIGITAL_EXPERIENCE_TYPE &&
        this._isCoveredByBundle(element, bundleMembersByTarget)
      ) {
        this.work.changes.removeMember(
          element.target,
          element.type,
          element.member
        )
      }
    }

    this._warnBundleDeletions(
      bundleMembersByTarget.get(ManifestTarget.DestructiveChanges)
    )
  }

  private _collectBundleMembers(
    elements: readonly ManifestElement[]
  ): Map<ManifestTarget, Set<string>> {
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

  private _isCoveredByBundle(
    element: ManifestElement,
    bundleMembersByTarget: Map<ManifestTarget, Set<string>>
  ): boolean {
    const bundleMembers = bundleMembersByTarget.get(element.target)
    if (!bundleMembers) return false
    // A canonical `DigitalExperience` member is `<base>/<space>.<ct>/<cn>` and
    // `<space>` (a Salesforce API name) cannot contain `.`, so the first `.`
    // delimits the parent bundle's member exactly. One Set lookup vs. an
    // `O(B)` linear `startsWith` scan over `bundleMembers`.
    const dotIdx = element.member.indexOf(DOT)
    // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement,BooleanLiteral -- equivalent/defensive: `BundleHandler.getElementDescriptor` constructs every `DigitalExperience` member as `<base>/<space>.<ct>/<cn>`, so a dotless member cannot reach this branch from the production pipeline.
    /* v8 ignore next -- defensive: a DigitalExperience member without `.` is unreachable in production */
    if (dotIdx < 0) return false
    return bundleMembers.has(element.member.slice(0, dotIdx))
  }

  private _warnBundleDeletions(bundleMembers: Set<string> | undefined): void {
    if (!bundleMembers) return
    const message = new MessageService()
    for (const bundleMember of bundleMembers) {
      this.work.warnings.push(
        new Error(
          message.getMessage('warning.DigitalExperienceBundleDeletion', [
            bundleMember,
          ])
        )
      )
    }
  }
}
