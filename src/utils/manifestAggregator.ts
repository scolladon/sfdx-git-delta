'use strict'
import type { HandlerResult } from '../types/handlerResult.js'
import { ManifestTarget } from '../types/handlerResult.js'
import type { Manifest, Manifests } from '../types/work.js'

const addToManifest = (store: Manifest, type: string, member: string) => {
  if (!store.has(type)) {
    store.set(type, new Set())
  }
  store.get(type)!.add(member)
}

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

    addToManifest(store, element.type, element.member)
  }

  return manifests
}
