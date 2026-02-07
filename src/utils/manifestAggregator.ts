'use strict'
import type { HandlerResult } from '../types/handlerResult.js'
import { ManifestTarget } from '../types/handlerResult.js'
import type { Manifests } from '../types/work.js'
import { fillPackageWithParameter } from './packageHelper.js'

export const aggregateManifests = (result: HandlerResult): Manifests => {
  const manifests: Manifests = {
    package: new Map(),
    destructiveChanges: new Map(),
  }

  for (const element of result.manifests) {
    const store =
      element.target === ManifestTarget.Package
        ? manifests.package
        : manifests.destructiveChanges

    fillPackageWithParameter({
      store,
      type: element.type,
      member: element.member,
    })
  }

  return manifests
}
