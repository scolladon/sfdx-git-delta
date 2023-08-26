'use strict'
import BaseProcessor from './baseProcessor'
import { buildIncludeHelper, IgnoreHelper } from '../utils/ignoreHelper'
import RepoSetup from '../utils/repoSetup'
import DiffLineInterpreter from '../service/diffLineInterpreter'
import { treatPathSep } from '../utils/childProcessUtils'
import { ADDITION, DELETION } from '../utils/gitConstants'
import { Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'
const TAB = '\t'

export default class IncludeProcessor extends BaseProcessor {
  gitHelper: RepoSetup
  from: string
  includeHelper: IgnoreHelper
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.gitHelper = new RepoSetup(this.config)
  }

  async process() {
    if (this._shouldProcess()) {
      await this._prepare()
      await this._process()
      this._cleanup()
    }
  }

  _shouldProcess() {
    return !!this.config.include || !!this.config.includeDestructive
  }

  async _prepare() {
    this.from = this.config.from
    const firstSha = await this.gitHelper.getFirstCommitRef()
    this.config.from = firstSha

    this.includeHelper = await buildIncludeHelper(this.config)
  }

  async _process() {
    const includeHolder: {
      [ADDITION]: string[]
      [DELETION]: string[]
    } = {
      [ADDITION]: [],
      [DELETION]: [],
    }
    const lines: string[] = await this.gitHelper.getAllFilesAsLineStream()
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

  async _processInclude(lines: string[]) {
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
    await lineProcessor.process(lines)
  }

  async _processIncludeDestructive(lines: string[]) {
    const to = this.config.to
    this.config.to = this.config.from
    this.config.from = to
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
    await lineProcessor.process(lines)
    this.config.to = to
  }

  async _cleanup() {
    this.config.from = this.from
  }
}
