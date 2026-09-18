'use strict'

import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION } from '../constant/gitConstants.js'
import TypeHandlerFactory from '../service/typeHandlerFactory.js'
import type { Config } from '../types/config.js'
import type { RunContext } from '../types/runContext.js'
import type { RenameTriple } from './changeSet.js'
import { getErrorMessage } from './errorUtils.js'
import { buildIgnoreHelper, type IgnoreHelper } from './ignoreHelper.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import type { RenamePathPair } from './repoGitDiff.js'

/**
 * Turns the `{ fromPath, toPath }` pairs git emitted for `-M` renames into
 * `RenameTriple` values by re-using the handler machinery to resolve each
 * side to its Salesforce (type, member).
 *
 * The `from` side is gated by the destructive ignore and the `to` side by
 * the global ignore; a pair rejected on either side yields no triple,
 * degrading to the add/delete shape the handler pipeline already produces.
 * Pairs where metadata resolution fails (unknown type) or where the from/to
 * side land on the same component are skipped too — those reduce to normal
 * add/delete or no-ops already covered by the handler pipeline.
 */
export default class RenameResolver {
  private readonly config: Config
  private readonly factory: TypeHandlerFactory

  constructor(ctx: RunContext) {
    this.config = ctx.config
    this.factory = new TypeHandlerFactory(ctx)
  }

  @log
  public async resolve(
    pairs: readonly RenamePathPair[]
  ): Promise<readonly RenameTriple[]> {
    const ignoreHelper = await buildIgnoreHelper(this.config)
    const triples: RenameTriple[] = []
    for (const pair of pairs) {
      const resolved = await this._resolve(pair, ignoreHelper)
      if (resolved) triples.push(resolved)
    }
    return triples
  }

  private async _resolve(
    pair: RenamePathPair,
    ignoreHelper: IgnoreHelper
  ): Promise<{ type: string; from: string; to: string } | null> {
    try {
      const fromLine = `${DELETION}${TAB}${pair.fromPath}`
      const toLine = `${ADDITION}${TAB}${pair.toPath}`
      if (!ignoreHelper.keep(fromLine) || !ignoreHelper.keep(toLine)) {
        return null
      }
      const fromHandler = await this.factory.getTypeHandler(fromLine)
      const toHandler = await this.factory.getTypeHandler(toLine)
      const from = fromHandler.getElementDescriptor()
      const to = toHandler.getElementDescriptor()
      if (from.type !== to.type) return null
      // Stryker disable next-line ConditionalExpression -- equivalent: ChangeSet.recordRename has its own `if (from === to) return` guard, so the no-op skip is redundant when the apply() loop hands the same-member pair downstream
      if (from.member === to.member) return null
      return { type: from.type, from: from.member, to: to.member }
    } catch (error) {
      Logger.warn(
        // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: log content is observability only; tests assert on the null return
        lazy`RenameResolver._resolve: skipping ${pair.fromPath} -> ${pair.toPath}: ${() => getErrorMessage(error)}`
      )
      return null
    }
  }
}
