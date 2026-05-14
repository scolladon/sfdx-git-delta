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

// A `DigitalExperienceBundle` member deploys (or deletes) every
// `DigitalExperience` child of its site, so when both appear in the same
// manifest the page-scoped `DigitalExperience` members are redundant. This
// processor collapses them per manifest, and — because a whole-bundle deletion
// is org-gated — warns when a `DigitalExperienceBundle` lands in
// destructiveChanges.
export default class DigitalExperienceBundleProcessor extends BaseProcessor {
  @log
  public override async process(): Promise<void> {
    const elements = this.work.changes.toElements()
    const bundleMembersByTarget = this._collectBundleMembers(elements)

    for (const element of elements) {
      if (
        element.type === DIGITAL_EXPERIENCE_TYPE &&
        this._isCoveredByBundle(element, bundleMembersByTarget)
      ) {
        this.work.changes.removeElement(element)
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
    for (const bundleMember of bundleMembers) {
      // literal dot separator: `site/foo` must not swallow `site/foobar.<ct>/<cn>`
      if (element.member.startsWith(`${bundleMember}${DOT}`)) return true
    }
    return false
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
