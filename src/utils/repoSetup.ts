'use strict'
import { spawnSync, SpawnSyncOptionsWithStringEncoding } from 'child_process'
import { UTF8_ENCODING } from './gitConstants'
import { Config } from '../model/Config'

const HEAD = 'HEAD'

const revparseParams = ['rev-parse']
const revlistParams = ['rev-list', '--max-parents=0', HEAD]
const gitConfig = ['config', 'core.quotepath', 'off']

export default class RepoSetup {
  config: Config

  constructor(config: Config) {
    this.config = config
  }

  isToEqualHead(): boolean {
    if (this.config.to === HEAD) {
      return true
    }
    const { stdout: headSHA } = spawnSync('git', [...revparseParams, HEAD], <
      SpawnSyncOptionsWithStringEncoding
    >{
      cwd: this.config.repo,
      encoding: UTF8_ENCODING,
    })

    const { stdout: toSHA } = spawnSync(
      'git',
      [...revparseParams, this.config.to],
      <SpawnSyncOptionsWithStringEncoding>{
        cwd: this.config.repo,
        encoding: UTF8_ENCODING,
      }
    )

    return toSHA === headSHA
  }

  repoConfiguration(): void {
    spawnSync('git', gitConfig, {
      cwd: this.config.repo,
    })
  }

  computeFromRef(): string {
    let firstCommitSHA = this.config.from
    if (!firstCommitSHA) {
      firstCommitSHA = spawnSync('git', revlistParams, <
        SpawnSyncOptionsWithStringEncoding
      >{
        cwd: this.config.repo,
        encoding: UTF8_ENCODING,
      }).stdout
    }
    return firstCommitSHA
  }
}
