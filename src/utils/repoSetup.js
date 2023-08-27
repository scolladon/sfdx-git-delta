'use strict'
const { getStreamContent } = require('./childProcessUtils')
const { GIT_COMMAND, UTF8_ENCODING } = require('./gitConstants')
const { spawn } = require('child_process')

const commitCheckParams = ['cat-file', '-t']
const firstCommitParams = ['rev-list', '--max-parents=0', 'HEAD']
const gitConfig = ['config', 'core.quotepath', 'off']

class RepoSetup {
  constructor(config) {
    this.config = config
    this.spawnConfig = {
      cwd: this.config.repo,
    }
  }

  async repoConfiguration() {
    await getStreamContent(spawn(GIT_COMMAND, gitConfig, this.spawnConfig))
  }

  async getCommitRefType(commitRef) {
    const data = await getStreamContent(
      spawn(GIT_COMMAND, [...commitCheckParams, commitRef], {
        cwd: this.config.repo,
      })
    )

    return data?.toString(UTF8_ENCODING)
  }

  async getFirstCommitRef() {
    const data = await getStreamContent(
      spawn(GIT_COMMAND, firstCommitParams, {
        cwd: this.config.repo,
      })
    )

    return data?.toString(UTF8_ENCODING)
  }
}

module.exports = RepoSetup
