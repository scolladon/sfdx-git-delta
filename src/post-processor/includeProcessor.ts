'use strict'
import GitAdapter from '../adapter/GitAdapter'
import { ADDITION, DELETION } from '../constant/gitConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import DiffLineInterpreter from '../service/diffLineInterpreter'
import type { Work } from '../types/work'
import { treatPathSep } from '../utils/fsUtils'
import { IgnoreHelper } from '../utils/ignoreHelper'

import BaseProcessor from './baseProcessor'
const TAB = '\t'

export default class IncludeProcessor extends BaseProcessor {
  protected readonly gitAdapter: GitAdapter
  protected from: string
  protected includeHelper!: IgnoreHelper
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.gitAdapter = GitAdapter.getInstance(this.config)
    this.from = this.config.from
  }

  public override async process() {
    if (this._shouldProcess()) {
      await this._prepare()
      await this._process()
      this._cleanup()
    }
  }

  protected _shouldProcess() {
    return !!this.config.include || !!this.config.includeDestructive
  }

  protected async _prepare() {
    const firstSha = await this.gitAdapter.getFirstCommitRef()
    this.config.from = firstSha

    this.includeHelper = await IgnoreHelper.getIncludeInstance(this.config)
  }

  protected async _process() {
    const includeHolder: {
      [ADDITION]: string[]
      [DELETION]: string[]
    } = {
      [ADDITION]: [],
      [DELETION]: [],
    }
    const lines: string[] = await this.gitAdapter.getFilesPath(
      this.config.source
    )
    for (const line of lines) {
      Object.keys(includeHolder).forEach(changeType => {
        const changedLine = `${changeType}${TAB}${treatPathSep(line)}`
        if (!this.includeHelper.keep(changedLine)) {
          includeHolder[changeType as keyof typeof includeHolder].push(
            changedLine
          )
        }
      })
    }

    if (includeHolder[ADDITION].length > 0) {
      await this._processInclude(includeHolder[ADDITION])
    }

    if (includeHolder[DELETION].length > 0) {
      await this._processIncludeDestructive(includeHolder[DELETION])
    }
  }

  protected async _processInclude(lines: string[]) {
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
    await lineProcessor.process(lines)
  }

  protected async _processIncludeDestructive(lines: string[]) {
    const to = this.config.to
    this.config.to = this.config.from
    this.config.from = to
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
    await lineProcessor.process(lines)
    this.config.to = to
  }

  protected async _cleanup() {
    this.config.from = this.from
  }
}
