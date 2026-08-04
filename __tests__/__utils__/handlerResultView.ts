'use strict'
import type {
  CopyOperation,
  HandlerResult,
  ManifestElement,
} from '../../src/types/handlerResult'
import ChangeSet from '../../src/utils/changeSet'

// The read-model projection of a handler result. `ChangeSet.from` folds the
// flat element sequence into the indexed read model, and `toElements()`
// orders Package before DestructiveChanges and de-duplicates, which is the
// semantics every migrated assertion was written against.
export const elementsOf = (result: HandlerResult): ManifestElement[] =>
  ChangeSet.from(result.elements).toElements()

export const makeHandlerResult = (parts: {
  manifests?: ManifestElement[]
  copies?: CopyOperation[]
  warnings?: Error[]
}): HandlerResult => ({
  elements: parts.manifests ?? [],
  copies: parts.copies ?? [],
  warnings: parts.warnings ?? [],
})
