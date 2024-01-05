'use strict'
import { Config } from '../types/config'
import { getSpawnContent, getSpawnContentByLine } from './childProcessUtils'
import { GIT_COMMAND } from '../constant/gitConstants'
import { UTF8_ENCODING } from '../constant/fsConstants'
import { SpawnOptionsWithoutStdio } from 'child_process'
const commitCheckParams = ['cat-file', '-t']
const firstCommitParams = ['rev-list', '--max-parents=0', 'HEAD']
const allFilesParams = ['ls-tree', '--name-only', '-r']
const gitConfig = ['config', 'core.quotepath', 'off']

export default class RepoSetup {
  protected readonly spawnConfig: SpawnOptionsWithoutStdio

  constructor(protected readonly config: Config) {
    this.spawnConfig = {
      cwd: config.repo,
    }
  }

  public async repoConfiguration() {
    await getSpawnContent(GIT_COMMAND, gitConfig, this.spawnConfig)
  }

  public async getCommitRefType(commitRef: string) {
    const data: Buffer = await getSpawnContent(
      GIT_COMMAND,
      [...commitCheckParams, commitRef],
      {
        cwd: this.config.repo,
      }
    )

    return data?.toString(UTF8_ENCODING)
  }

  public async getFirstCommitRef() {
    const data: Buffer = await getSpawnContent(GIT_COMMAND, firstCommitParams, {
      cwd: this.config.repo,
    })

    return data?.toString(UTF8_ENCODING)
  }

  public async getAllFilesAsLineStream() {
    const result = await getSpawnContentByLine(
      GIT_COMMAND,
      [...allFilesParams, this.config.to],
      this.spawnConfig
    )

    return result
  }
}
