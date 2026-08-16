'use strict'

import type { Config } from '../types/config.js'

/**
 * Narrow adapter-boundary port consumed by callers that only need to
 * enumerate file paths under a tree at a revision (IOExecutor's directory
 * copies, IncludeProcessor, fsHelper's readDirs). Kept separate from
 * GitBlobReader — which is about blob content — rather than widening that
 * port to cover a concern it has nothing to do with.
 */

/**
 * Identifies one tree-index bucket: the revision being read, paired with
 * the scope it was pre-built under. GitAdapter is bound to the repository
 * rather than to one run, so two callers reading the same revision under
 * different scopes must resolve to different buckets — a bare revision
 * string is no longer enough to key a lookup.
 */
export type TreeScope = Readonly<{
  revision: string
  scopePaths: readonly string[]
}>

// Builds the TreeScope most readers need: the revision being read, paired
// with the run's configured source scope. Bundled here rather than left as
// a positional (path, revision, scopePaths) triple on every reader, so the
// revision and its scope can never be passed out of sync with each other.
export const treeScopeAt = (config: Config, revision: string): TreeScope => ({
  revision,
  scopePaths: config.source,
})

export interface GitTreeLister {
  /**
   * Lists every path indexed under `paths` at `scope.revision`, backed by
   * the tree index built via GitAdapter#preBuildTreeIndex for that same
   * (revision, scope) pair. A (revision, scope) pair that was never
   * pre-built resolves to an empty array rather than indexing lazily or
   * throwing.
   */
  getFilesPath(paths: string | string[], scope: TreeScope): Promise<string[]>
}
