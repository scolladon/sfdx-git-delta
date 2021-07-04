'use strict'
const childProcess = require('child_process')
const gc = require('./gitConstants')

const HEAD = 'HEAD'
const STASH = 'stash'
const CHECKOUT = 'checkout'

const stashUntracked = [STASH, '-u']
const stashDrop = [STASH, 'drop']
const checkoutStash = ['stash', '--', '.']
const revparseParams = ['rev-parse']
const checkout = [CHECKOUT]
const revlistParams = ['rev-list', '--max-parents=0', HEAD]
const gitConfig = ['config', 'core.quotepath', 'off']

const _bufToStr = buf => {
  return Buffer.from(buf).toString(gc.UTF8_ENCODING).trim()
}

class RepoSetup {
  constructor(config) {
    this.config = config
  }

  repoConfiguration() {
    childProcess.spawnSync('git', gitConfig, {
      cwd: this.config.repo,
    })

    const headSHA = _bufToStr(
      childProcess.spawnSync('git', [...revparseParams, HEAD], {
        cwd: this.config.repo,
      }).stdout
    )

    this.referenceSHA = _bufToStr(
      childProcess.spawnSync('git', [...revparseParams, this.config.to], {
        cwd: this.config.repo,
      }).stdout
    )

    this.isToEqualHead = this.referenceSHA === headSHA
  }

  getFirstSHA() {
    let firstCommitSHA
    if (!this.config.from) {
      firstCommitSHA = _bufToStr(
        childProcess.spawnSync('git', revlistParams, {
          cwd: this.config.repo,
        }).stdout
      )
    }
    return firstCommitSHA
  }

  checkoutTo() {
    if (this.isToEqualHead) {
      return
    }
    childProcess.spawnSync('git', [...checkout, this.config.to], {
      cwd: this.config.repo,
    })
  }

  checkoutRef() {
    if (this.isToEqualHead) {
      return
    }
    childProcess.spawnSync('git', stashUntracked, {
      cwd: this.config.repo,
    }).stdout

    childProcess.spawnSync('git', [...checkout, this.referenceSHA], {
      cwd: this.config.repo,
    }).stdout

    childProcess.spawnSync(
      'git',
      [...checkout, ...checkoutStash, this.config.repo],
      {
        cwd: this.config.repo,
      }
    ).stdout

    childProcess.spawnSync('git', stashDrop, {
      cwd: this.config.repo,
    }).stdout
  }
}

module.exports = RepoSetup
