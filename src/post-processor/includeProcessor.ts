'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import DiffLineInterpreter from '../service/diffLineInterpreter.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult, mergeResults } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { buildIncludeHelper } from '../utils/ignoreHelper.js'
import { log } from '../utils/LoggingDecorator.js'

import BaseProcessor from './baseProcessor.js'

type GitChange = typeof ADDITION | typeof DELETION

export default class IncludeProcessor extends BaseProcessor {
  protected readonly gitAdapter: GitAdapter
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.gitAdapter = GitAdapter.getInstance(this.config)
  }

  override get isCollector(): boolean {
    return true
  }

  protected _shouldProcess() {
    return !!this.config.include || !!this.config.includeDestructive
  }

  @log
  public override async process() {
    // No-op: IncludeProcessor is handled via transformAndCollect()
  }

  public override async transformAndCollect(): Promise<HandlerResult> {
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
    const lines: string[] = await this.gitAdapter.getFilesPath(
      this.config.source
    )
    for (const line of lines) {
      gitChanges.forEach((changeType: GitChange) => {
        const changedLine = `${changeType}${TAB}${line}`
        if (!includeHelper.keep(changedLine)) {
          if (!includeLines.has(changeType)) {
            includeLines.set(changeType, [])
          }
          includeLines.get(changeType)?.push(changedLine)
        }
      })
    }
    return includeLines
  }

  protected async _collectIncludes(
    includeLines: Map<GitChange, string[]>
  ): Promise<HandlerResult> {
    if (includeLines.size === 0) {
      return emptyResult()
    }

    const firstSHA = await this.gitAdapter.getFirstCommitRef()
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
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
