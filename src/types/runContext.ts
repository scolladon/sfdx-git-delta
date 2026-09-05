'use strict'

import type { TreeReader } from '../adapter/treeReader.js'
import { withoutRevision } from '../adapter/treeReader.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from './config.js'

export type RunContext = Readonly<{
  config: Config
  metadata: MetadataRepository
  trees: TreeReader
}>

/**
 * The single derive point for a pass that runs under overridden revisions
 * (IncludeProcessor's ADDITION / DELETION re-entry). `trees` is deliberately
 * carried through UNCHANGED: this function only ever rebinds `config.from`/
 * `config.to`, so a reader that already holds an index for the overridden
 * revision keeps answering from it. The include DELETION pass needs the
 * opposite of that — its liveness check must answer `false` regardless of
 * what the reader holds for the pass's effective `config.to` — and gets that
 * explicitly via `withMaskedTreeRevision` below, rather than by relying on
 * this function to leave the revision unindexed.
 */
export const withRevisions = (
  ctx: RunContext,
  revisions?: { from: string; to: string }
): RunContext =>
  revisions ? { ...ctx, config: { ...ctx.config, ...revisions } } : ctx

/**
 * Sibling to `withRevisions`: masks one named revision out of `trees` so
 * every tree-index-backed read at that revision answers as an unbuilt index
 * would (`false`/`[]`), no matter what the underlying reader actually holds
 * for it. Used to make the include DELETION pass's container-liveness check
 * degrade unconditionally, instead of depending on the first commit
 * happening to be unindexed.
 */
export const withMaskedTreeRevision = (
  ctx: RunContext,
  revision: string
): RunContext => ({ ...ctx, trees: withoutRevision(ctx.trees, revision) })
