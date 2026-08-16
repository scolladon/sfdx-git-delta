'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION } from '../constant/gitConstants.js'
import DiffLineInterpreter from '../service/diffLineInterpreter.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult, mergeResults } from '../types/handlerResult.js'
import type { RunContext } from '../types/runContext.js'
import type ChangeSet from '../utils/changeSet.js'
import { buildIncludeHelper } from '../utils/ignoreHelper.js'
import { log } from '../utils/LoggingDecorator.js'

import BaseProcessor, {
  emptyOutcome,
  type ProcessorOutcome,
} from './baseProcessor.js'

type GitChange = typeof ADDITION | typeof DELETION

export default class IncludeProcessor extends BaseProcessor {
  protected readonly gitAdapter: GitAdapter
  constructor(ctx: RunContext) {
    super(ctx)
    this.gitAdapter = GitAdapter.getInstance(this.config)
  }

  override get isCollector(): boolean {
    return true
  }

  protected _shouldProcess() {
    return !!this.config.include || !!this.config.includeDestructive
  }

  @log
  public override async process(
    _changes: ChangeSet
  ): Promise<ProcessorOutcome> {
    // No-op: IncludeProcessor is handled via transformAndCollect()
    return emptyOutcome()
  }

  public override async transformAndCollect(
    _changes: ChangeSet
  ): Promise<HandlerResult> {
    if (!this._shouldProcess()) {
      return emptyResult()
    }

    const includeLines = await this._gatherIncludeLines()
    return await this._collectIncludes(includeLines)
  }

  protected async _gatherIncludeLines(): Promise<Map<GitChange, string[]>> {
    const includeHelper = await buildIncludeHelper(this.config)
    const includeLines = new Map<GitChange, string[]>()
    const gitChanges: GitChange[] = [ADDITION, DELETION]
    const lines: string[] = this.ctx.trees.filesUnder(
      this.config.to,
      this.config.source
    )
    for (const line of lines) {
      gitChanges.forEach((changeType: GitChange) => {
        const changedLine = `${changeType}${TAB}${line}`
        if (!includeHelper.keep(changedLine)) {
          if (!includeLines.has(changeType)) {
            includeLines.set(changeType, [])
          }
          // Stryker disable next-line OptionalChaining -- equivalent: defensive optional chain; the preceding `if (!includeLines.has(changeType))` guarantees the slot is set before this push, so the optional chain is unreachable
          includeLines.get(changeType)?.push(changedLine)
        }
      })
    }
    return includeLines
  }

  protected async _collectIncludes(
    includeLines: Map<GitChange, string[]>
  ): Promise<HandlerResult> {
    // Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: empty-input fast path; flipping to false continues into the gitAdapter.getFirstCommitRef + DiffLineInterpreter walk with no entries, which produces an empty result anyway
    if (includeLines.size === 0) {
      return emptyResult()
    }

    const firstSHA = await this.gitAdapter.getFirstCommitRef()
    const lineProcessor = new DiffLineInterpreter(this.ctx)
    const results: HandlerResult[] = []

    if (includeLines.has(ADDITION)) {
      const result = await lineProcessor.process(includeLines.get(ADDITION)!, {
        from: firstSHA,
        to: this.config.to,
      })
      results.push(result)
    }

    if (includeLines.has(DELETION)) {
      const result = await lineProcessor.process(includeLines.get(DELETION)!, {
        from: this.config.to,
        to: firstSHA,
      })
      results.push(result)
    }

    return mergeResults(...results)
  }
}
