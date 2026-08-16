'use strict'

import type { TreeIndex } from './treeIndex.js'

/**
 * Run-owned collection of tree indexes, one per revision. Built once by
 * main.ts (one `TreeIndex` per revision, under the run's actual scope) and
 * threaded down to every reader — a builder/reader scope mismatch is no
 * longer possible because there is nothing left to recompute: readers pull
 * the exact index the run built for a given revision, or get `undefined`.
 *
 * A revision nobody built an index for resolves to `undefined`; callers
 * degrade to an empty read (matching the index-build failure's own
 * degrade-and-log semantics) rather than indexing lazily or throwing.
 */
export type TreeIndexes = Readonly<{
  at(revision: string): TreeIndex | undefined
}>

// Safe default for callers/tests that never touch tree-index-backed
// lookups: every read resolves to the same empty degradation a revision
// that was never built would produce.
export const EMPTY_TREE_INDEXES: TreeIndexes = { at: () => undefined }

export const createTreeIndexes = (
  entries: ReadonlyMap<string, TreeIndex>
): TreeIndexes => ({
  at: revision => entries.get(revision),
})
