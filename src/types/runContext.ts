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
 * carried through UNCHANGED: the reader stays keyed by whatever revision each
 * read names, so a pass whose effective `config.to` is a revision no index was
 * built for still reads empty. That degrade is load-bearing on the include
 * DELETION path — rebinding `trees` here silently reclassifies deletions as
 * additions.
 */
export const withRevisions = (
  ctx: RunContext,
  revisions?: { from: string; to: string }
): RunContext =>
  revisions ? { ...ctx, config: { ...ctx.config, ...revisions } } : ctx
