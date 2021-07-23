'use strict'
import { spawnSync } from 'child_process'
import { UTF8_ENCODING } from './gitConstants'
import { Config } from '../model/Config'

const HEAD = 'HEAD'

const revparseParams = ['rev-parse']
const revlistParams = ['rev-list', '--max-parents=0', HEAD]
const gitConfig = ['config', 'core.quotepath', 'off']

const _bufToStr = (buf: Buffer) => {
  return Buffer.from(buf).toString(UTF8_ENCODING).trim()
}

class RepoSetup {
  config: Config

  constructor(config: Config) {
    this.config = config
  }

  isToEqualHead() {
    if (this.config.to === HEAD) {
      return true
    }
    const headSHA = _bufToStr(
      spawnSync('git', [...revparseParams, HEAD], {
        cwd: this.config.repo,
      }).stdout
    )

    const toSHA = _bufToStr(
      spawnSync('git', [...revparseParams, this.config.to], {
        cwd: this.config.repo,
      }).stdout
    )

    return toSHA === headSHA
  }

  repoConfiguration() {
    spawnSync('git', gitConfig, {
      cwd: this.config.repo,
    })
  }

  computeFromRef() {
    let firstCommitSHA = this.config.from
    if (!firstCommitSHA) {
      firstCommitSHA = _bufToStr(
        spawnSync('git', revlistParams, {
          cwd: this.config.repo,
        }).stdout
      )
    }
    return firstCommitSHA
  }
}

module.exports = RepoSetup
