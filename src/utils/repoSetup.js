'use strict'
const { getStreamContent } = require('./childProcessUtils')
const { spawn } = require('child_process')

const HEAD = 'HEAD'

const revparseParams = ['rev-parse']
const gitConfig = ['config', 'core.quotepath', 'off']

class RepoSetup {
  constructor(config) {
    this.config = config
    this.spawnConfig = {
      cwd: this.config.repo,
    }
  }

  async isToEqualHead() {
    if (this.config.to === HEAD) {
      return true
    }

    const headSHA = await getStreamContent(
      spawn('git', [...revparseParams, HEAD], this.spawnConfig)
    )

    const toSHA = await getStreamContent(
      spawn('git', [...revparseParams, this.config.to], this.spawnConfig)
    )

    return toSHA === headSHA
  }

  async repoConfiguration() {
    await getStreamContent(spawn('git', gitConfig, this.spawnConfig))
  }
}

module.exports = RepoSetup
