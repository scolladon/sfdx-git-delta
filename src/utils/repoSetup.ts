'use strict'
import { Config } from '../types/config'
import { getStreamContent, linify } from './childProcessUtils'
import { GIT_COMMAND, UTF8_ENCODING } from './gitConstants'
import { SpawnOptionsWithoutStdio, spawn } from 'child_process'
const commitCheckParams = ['cat-file', '-t']
const firstCommitParams = ['rev-list', '--max-parents=0', 'HEAD']
const allFilesParams = ['ls-tree', '--name-only', '-r']
const gitConfig = ['config', 'core.quotepath', 'off']

export default class RepoSetup {
  config: Config
  spawnConfig: SpawnOptionsWithoutStdio

  constructor(config: Config) {
    this.config = config
    this.spawnConfig = {
      cwd: this.config.repo,
    }
  }

  async repoConfiguration() {
    await getStreamContent(spawn(GIT_COMMAND, gitConfig, this.spawnConfig))
  }

  async getCommitRefType(commitRef: string) {
    const data: Buffer = await getStreamContent(
      spawn(GIT_COMMAND, [...commitCheckParams, commitRef], {
        cwd: this.config.repo,
      })
    )

    return data?.toString(UTF8_ENCODING)
  }

  async getFirstCommitRef() {
    const data: Buffer = await getStreamContent(
      spawn(GIT_COMMAND, firstCommitParams, {
        cwd: this.config.repo,
      })
    )

    return data?.toString(UTF8_ENCODING)
  }

  async getAllFilesAsLineStream() {
    const gitLs = spawn(
      GIT_COMMAND,
      [...allFilesParams, this.config.to],
      this.spawnConfig
    )

    return linify(gitLs.stdout)
  }
}
