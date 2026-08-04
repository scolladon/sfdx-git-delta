'use strict'
import {
  type CopyOperation,
  type HandlerResult,
  mergeResults,
} from '../types/handlerResult.js'
import { applyBundleRollup } from './bundleRollup.js'
import ChangeSet, { type RenameTriple } from './changeSet.js'

export type ChangesAssemblyResult = Readonly<{
  changes: ChangeSet
  copies: readonly CopyOperation[]
  warnings: readonly Error[]
}>

// Folds the handler pass and collector output into the single indexed read
// model consumed downstream. Renames fold in here — on the combined set
// (handler pass ∪ collectors), not the handler pass alone — because rename
// targets participate in forPackageManifest() and rename sources in
// forDestructiveManifest(), so folding renames any earlier would change
// which deletions get cancelled.
export const assembleChanges = (
  handlerResult: HandlerResult,
  postResult: HandlerResult,
  renameTriples: readonly RenameTriple[]
): ChangesAssemblyResult => {
  const combinedResult = mergeResults(handlerResult, postResult)
  const { keptElements, warnings: rollupWarnings } = applyBundleRollup(
    combinedResult.elements
  )
  const changes = ChangeSet.from(keptElements, renameTriples) // built exactly once

  return {
    changes,
    copies: combinedResult.copies,
    warnings: [...combinedResult.warnings, ...rollupWarnings],
  }
}
