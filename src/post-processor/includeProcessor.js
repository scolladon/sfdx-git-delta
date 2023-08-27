'use strict'
const BaseProcessor = require('./baseProcessor')
const { buildIncludeHelper } = require('../utils/ignoreHelper')
const RepoSetup = require('../utils/repoSetup')
const DiffLineInterpreter = require('../service/diffLineInterpreter')
const { treatPathSep } = require('../utils/childProcessUtils')
const { ADDITION, DELETION } = require('../utils/gitConstants')
const TAB = '\t'

class IncludeProcessor extends BaseProcessor {
  gitHelper
  constructor(work, metadata) {
    super(work, metadata)
    this.gitHelper = new RepoSetup(this.config)
  }

  async process() {
    if (this._shouldProcess()) {
      // *****Setup
      const from = this.config.from
      const firstSha = await this.gitHelper.getFirstCommitRef()
      this.config.from = firstSha

      const includeHelper = await buildIncludeHelper(this.config)

      // ******Execution
      const linesStream = await this.gitHelper.getAllFilesAsLineStream()
      const includeHolder = {
        [ADDITION]: [],
        [DELETION]: [],
      }
      for await (const line of linesStream) {
        Object.keys(includeHolder).forEach(changeType => {
          const changedLine = `${changeType}${TAB}${treatPathSep(line)}`
          if (!includeHelper.keep(changedLine)) {
            includeHolder[changeType].push(changedLine)
          }
        })
      }

      if (includeHolder[ADDITION].length > 0) {
        const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
        await lineProcessor.process(includeHolder[ADDITION])
      }

      if (includeHolder[DELETION].length > 0) {
        const to = this.config.to
        this.config.to = this.config.from
        this.config.from = to
        const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
        await lineProcessor.process(includeHolder[DELETION])
        this.config.to = to
      }
      this.config.from = from
    }
  }

  _shouldProcess() {
    return !!this.config.include || !!this.config.includeDestructive
  }
}

module.exports = IncludeProcessor
