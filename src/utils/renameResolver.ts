'use strict'

import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION } from '../constant/gitConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import TypeHandlerFactory from '../service/typeHandlerFactory.js'
import type { Work } from '../types/work.js'
import type ChangeSet from './changeSet.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import type { RenamePathPair } from './repoGitDiff.js'

/**
 * Turns the `{ fromPath, toPath }` pairs git emitted for `-M` renames into
 * `ChangeSet.recordRename(type, from, to)` calls by re-using the handler
 * machinery to resolve each side to its Salesforce (type, member).
 *
 * Pairs where metadata resolution fails (ignored path, unknown type) or where
 * the from/to side land on the same component are skipped — those reduce to
 * normal add/delete or no-ops already covered by the handler pipeline.
 */
export default class RenameResolver {
  private readonly factory: TypeHandlerFactory

  constructor(work: Work, metadata: MetadataRepository) {
    this.factory = new TypeHandlerFactory(work, metadata)
  }

  @log
  public async apply(
    changes: ChangeSet,
    pairs: readonly RenamePathPair[]
  ): Promise<void> {
    for (const pair of pairs) {
      const resolved = await this._resolve(pair)
      if (resolved) {
        changes.recordRename(resolved.type, resolved.from, resolved.to)
      }
    }
  }

  private async _resolve(
    pair: RenamePathPair
  ): Promise<{ type: string; from: string; to: string } | null> {
    try {
      const fromHandler = await this.factory.getTypeHandler(
        `${DELETION}${TAB}${pair.fromPath}`
      )
      const toHandler = await this.factory.getTypeHandler(
        `${ADDITION}${TAB}${pair.toPath}`
      )
      const from = fromHandler.getElementDescriptor()
      const to = toHandler.getElementDescriptor()
      if (from.type !== to.type) return null
      if (from.member === to.member) return null
      return { type: from.type, from: from.member, to: to.member }
    } catch (error) {
      Logger.debug(
        lazy`RenameResolver._resolve: skipping ${pair.fromPath} -> ${pair.toPath}: ${error}`
      )
      return null
    }
  }
}
