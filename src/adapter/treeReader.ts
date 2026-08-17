'use strict'

import { TreeIndex } from './treeIndex.js'

// Run-owned collection of tree indexes, one per revision. Built once by
// main.ts (one `TreeIndex` per revision, under the run's actual scope) and
// threaded down to every reader — a builder/reader scope mismatch is no
// longer possible because there is nothing left to recompute: readers pull
// the exact index the run built for a given revision, or fall through to a
// shared empty index (a Null Object), never `undefined`.
export type TreeReader = Readonly<{
  pathExists(revision: string, path: string): boolean
  filesUnder(revision: string, paths: string | string[]): string[]
  children(revision: string, dir: string): string[]
}>

// The read-only face of TreeIndex. `indexAt` below resolves through this
// rather than the full class so that `add` is not merely unused but
// unnameable: NO_INDEX is one process-wide instance shared by every
// concurrent run, and a lazy-indexing edit inside this module would
// otherwise compile clean while poisoning every other run's empty reads.
type ReadableIndex = Pick<
  TreeIndex,
  'pathExists' | 'getFilesPath' | 'listChildren'
>

// Null Object. An index with no entries answers every question with exactly
// the empty/false result each reader used to spell out for itself as
// `at(rev)?.x() ?? default` — including for ROOT_PATHS, where pathExists
// short-circuits to `size > 0` instead of walking to the (always present)
// root node.
const NO_INDEX: ReadableIndex = new TreeIndex()

export const createTreeReader = (
  entries: ReadonlyMap<string, TreeIndex>
): TreeReader => {
  const indexAt = (revision: string): ReadableIndex =>
    entries.get(revision) ?? NO_INDEX
  return {
    pathExists: (revision, path) => indexAt(revision).pathExists(path),
    filesUnder: (revision, paths) => indexAt(revision).getFilesPath(paths),
    children: (revision, dir) => indexAt(revision).listChildren(dir),
  }
}

// Safe default for callers/tests that never touch tree-index-backed
// lookups: every read resolves to the same empty degradation a revision
// that was never built would produce. Expressed via the real factory over
// an empty map so it cannot drift from what createTreeReader actually does.
export const EMPTY_TREE_READER: TreeReader = createTreeReader(new Map())
