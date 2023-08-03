'use strict'
import BaseProcessor from './baseProcessor'
import { buildIncludeHelper } from '../utils/ignoreHelper'
import RepoSetup from '../utils/repoSetup'
import DiffLineInterpreter from '../service/diffLineInterpreter'
import { treatPathSep } from '../utils/childProcessUtils'
import { ADDITION, DELETION } from '../utils/gitConstants'
const TAB = '\t'

export default class IncludeProcessor extends BaseProcessor {
  gitHelper
  from
  includeHelper
  constructor(work, metadata) {
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
    const includeHolder = {
      [ADDITION]: [],
      [DELETION]: [],
    }
    const linesStream = await this.gitHelper.getAllFilesAsLineStream()
    for await (const line of linesStream) {
      Object.keys(includeHolder).forEach(changeType => {
        const changedLine = `${changeType}${TAB}${treatPathSep(line)}`
        if (!this.includeHelper.keep(changedLine)) {
          includeHolder[changeType].push(changedLine)
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

  async _processInclude(lines) {
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
    await lineProcessor.process(lines)
  }

  async _processIncludeDestructive(lines) {
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
