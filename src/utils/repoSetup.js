'use strict'
const childProcess = require('child_process')
const gc = require('./gitConstants')

const HEAD = 'HEAD'

const revparseParams = ['rev-parse']
const revlistParams = ['rev-list', '--max-parents=0', HEAD]
const gitConfig = ['config', 'core.quotepath', 'off']

const _bufToStr = buf => {
  return Buffer.from(buf).toString(gc.UTF8_ENCODING).trim()
}

class RepoSetup {
  constructor(config) {
    this.config = config
    this.config.generateDelta
  }

  isToEqualHead() {
    if (this.config.to === HEAD) {
      return true
    }
    const headSHA = _bufToStr(
      childProcess.spawnSync('git', [...revparseParams, HEAD], {
        cwd: this.config.repo,
      }).stdout
    )

    const toSHA = _bufToStr(
      childProcess.spawnSync('git', [...revparseParams, this.config.to], {
        cwd: this.config.repo,
      }).stdout
    )

    return toSHA === headSHA
  }

  repoConfiguration() {
    childProcess.spawnSync('git', gitConfig, {
      cwd: this.config.repo,
    })
  }

  computeFromRef() {
    let firstCommitSHA = this.config.from
    if (!firstCommitSHA) {
      firstCommitSHA = _bufToStr(
        childProcess.spawnSync('git', revlistParams, {
          cwd: this.config.repo,
        }).stdout
      )
    }
    return firstCommitSHA
  }
}

module.exports = RepoSetup
