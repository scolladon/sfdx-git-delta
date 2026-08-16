'use strict'

/**
 * Narrow adapter-boundary port consumed by callers that only need to
 * enumerate file paths under a tree at a revision (IOExecutor's directory
 * copies, IncludeProcessor, fsHelper's readDirs). Kept separate from
 * GitBlobReader — which is about blob content — rather than widening that
 * port to cover a concern it has nothing to do with.
 */
export interface GitTreeLister {
  /**
   * Lists every path indexed under `paths` at `revision`, backed by the
   * tree index built via GitAdapter#preBuildTreeIndex. A revision that was
   * never pre-built resolves to an empty array rather than indexing lazily
   * or throwing.
   */
  getFilesPath(paths: string | string[], revision: string): Promise<string[]>
}
