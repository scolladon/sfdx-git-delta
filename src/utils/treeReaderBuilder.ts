'use strict'
import type GitAdapter from '../adapter/GitAdapter.js'
import type { TreeIndex } from '../adapter/treeIndex.js'
import {
  createTreeReader,
  EMPTY_TREE_READER,
  type TreeReader,
} from '../adapter/treeReader.js'
import type { Config } from '../types/config.js'

// The revisions a run attempted to index, paired with whether that attempt
// produced an index. `unindexed` drives the tree-index-unavailable warning
// in main.ts: a revision degrading silently to empty reads is the same
// defect class as the held-addition probe failure, so it gets the same
// visible-signal treatment.
export type TreeReaderBuildResult = Readonly<{
  trees: TreeReader
  unindexed: readonly string[]
}>

// One TreeIndex per revision, built once per run under the run's own scope
// and threaded to every reader through RunContext rather than cached on
// GitAdapter: a reader can never see a different scope than the one this
// build ran under (a shared, scope-keyed cache — the design this replaced —
// is an implicit contract that drifts). An empty scope means the run
// touches nothing index-backed, so no tree is walked at all — nothing was
// attempted, so nothing is reported unindexed.
export const buildRunTreeReader = async (
  gitAdapter: Pick<GitAdapter, 'buildTreeIndex'>,
  config: Pick<Config, 'to' | 'from'>,
  scopePaths: readonly string[]
): Promise<TreeReaderBuildResult> => {
  if (scopePaths.length === 0) {
    return { trees: EMPTY_TREE_READER, unindexed: [] }
  }
  const [toIndex, fromIndex] = await Promise.all([
    gitAdapter.buildTreeIndex(config.to, scopePaths),
    gitAdapter.buildTreeIndex(config.from, scopePaths),
  ])
  const entries = new Map<string, TreeIndex>()
  const unindexed: string[] = []
  if (toIndex) {
    entries.set(config.to, toIndex)
  } else {
    unindexed.push(config.to)
  }
  if (fromIndex) {
    entries.set(config.from, fromIndex)
  } else {
    unindexed.push(config.from)
  }
  return { trees: createTreeReader(entries), unindexed }
}
