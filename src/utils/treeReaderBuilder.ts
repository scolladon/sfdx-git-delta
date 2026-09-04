'use strict'
import type GitAdapter from '../adapter/GitAdapter.js'
import type { TreeIndex } from '../adapter/treeIndex.js'
import {
  createTreeReader,
  EMPTY_TREE_READER,
  type TreeReader,
} from '../adapter/treeReader.js'
import type { Config } from '../types/config.js'

// One TreeIndex per revision, built once per run under the run's own scope
// and threaded to every reader through RunContext rather than cached on
// GitAdapter: a reader can never see a different scope than the one this
// build ran under (a shared, scope-keyed cache — the design this replaced —
// is an implicit contract that drifts). An empty scope means the run
// touches nothing index-backed, so no tree is walked at all.
export const buildRunTreeReader = async (
  gitAdapter: Pick<GitAdapter, 'buildTreeIndex'>,
  config: Pick<Config, 'to' | 'from'>,
  scopePaths: readonly string[]
): Promise<TreeReader> => {
  if (scopePaths.length === 0) return EMPTY_TREE_READER
  const [toIndex, fromIndex] = await Promise.all([
    gitAdapter.buildTreeIndex(config.to, scopePaths),
    gitAdapter.buildTreeIndex(config.from, scopePaths),
  ])
  const entries = new Map<string, TreeIndex>()
  // Stryker disable ConditionalExpression -- equivalent: forcing either guard to always run stores `undefined` at that revision key instead of skipping it, but the only reader is createTreeReader's `entries.get(revision) ?? NO_INDEX`, and Map.get answers `undefined` for an absent key and an explicitly-undefined value alike. `entries` is local to this function and exposes no has/size/enumeration, so no observer can tell the two apart
  if (toIndex) entries.set(config.to, toIndex)
  if (fromIndex) entries.set(config.from, fromIndex)
  // Stryker restore ConditionalExpression
  return createTreeReader(entries)
}
