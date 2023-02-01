'use strict'
const { getStreamContent } = require('./childProcessUtils')
const { UTF8_ENCODING } = require('./gitConstants')
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
    const data = await getStreamContent(
      spawn('git', [...commitCheckParams, commitRef], {
        cwd: this.config.repo,
      })
    )

    return data?.toString(UTF8_ENCODING)
  }
}

module.exports = RepoSetup
