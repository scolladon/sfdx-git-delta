'use strict'

import type { TreeReader } from '../adapter/treeReader.js'
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
 * revision keeps answering from it. The include passes' other side is the
 * empty tree: no reader ever indexes it (only commits are), so every tree
 * read there answers `false`/`[]`, as the empty tree must.
 */
export const withRevisions = (
  ctx: RunContext,
  revisions?: { from: string; to: string }
): RunContext =>
  revisions ? { ...ctx, config: { ...ctx.config, ...revisions } } : ctx
