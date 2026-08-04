'use strict'
import type {
  CopyOperation,
  HandlerResult,
  ManifestElement,
} from '../../src/types/handlerResult'
import ChangeSet from '../../src/utils/changeSet'

// The read-model projection of a handler result. Today the result already carries a
// ChangeSet; after the wire format flattens, this rebuilds the same read model from the
// returned element sequence. `toElements()` orders Package before DestructiveChanges and
// de-duplicates, which is the semantics every migrated assertion was written against.
export const elementsOf = (result: HandlerResult): ManifestElement[] =>
  result.changes.toElements()

export const makeHandlerResult = (parts: {
  manifests?: ManifestElement[]
  copies?: CopyOperation[]
  warnings?: Error[]
}): HandlerResult => ({
  changes: ChangeSet.from(parts.manifests ?? []),
  copies: parts.copies ?? [],
  warnings: parts.warnings ?? [],
})
