'use strict'
const { getStreamContent } = require('./childProcessUtils')
const { spawn } = require('child_process')
const commitCheckParams = ['cat-file', '-t']
const gitConfig = ['config', 'core.quotepath', 'off']

class RepoSetup {
  constructor(config) {
    this.config = config
    this.spawnConfig = {
      cwd: this.config.repo,
    }
  }

  async repoConfiguration() {
    await getStreamContent(spawn('git', gitConfig, this.spawnConfig))
  }

  async getCommitRefType(commitRef) {
    return await getStreamContent(
      spawn('git', [...commitCheckParams, commitRef], {
        cwd: this.config.repo,
      })
    )
  }
}

module.exports = RepoSetup
