'use strict'
const { spawn } = require('child_process')

const HEAD = 'HEAD'

const revparseParams = ['rev-parse']
const revlistParams = ['rev-list', '--max-parents=0', HEAD]
const gitConfig = ['config', 'core.quotepath', 'off']

const _getStreamContent = async stream => {
  const content = []
  for await (const chunk of stream) {
    content.push(chunk)
  }
  return content.join('')
}

class RepoSetup {
  constructor(config) {
    this.config = config
  }

  async isToEqualHead() {
    if (this.config.to === HEAD) {
      return true
    }

    const headSHA = await _getStreamContent(
      spawn('git', [...revparseParams, HEAD], {
        cwd: this.config.repo,
      }).stdout
    )

    const toSHA = await _getStreamContent(
      spawn('git', [...revparseParams, this.config.to], {
        cwd: this.config.repo,
      }).stdout
    )

    return toSHA === headSHA
  }

  async repoConfiguration() {
    await _getStreamContent(
      spawn('git', gitConfig, {
        cwd: this.config.repo,
      }).stdout
    )
  }

  async computeFromRef() {
    let firstCommitSHA = this.config.from
    if (!firstCommitSHA) {
      firstCommitSHA = await _getStreamContent(
        spawn('git', revlistParams, {
          cwd: this.config.repo,
        }).stdout
      )
    }
    return firstCommitSHA
  }
}

module.exports = RepoSetup
