'use strict'
import { spawnSync, SpawnSyncOptionsWithStringEncoding } from 'child_process'
import { treatEOL } from './childProcessUtils'
import { UTF8_ENCODING } from './gitConstants'
import { Config } from '../model/Config'

const unitDiffParams = ['--no-pager', 'diff', '--no-prefix', '-U200']

module.exports = (filePath: string, config: Config) => {
  const { stdout: diff } = spawnSync(
    'git',
    [...unitDiffParams, config.from, config.to, '--', filePath],
    {
      cwd: config.repo,
      encoding: UTF8_ENCODING,
    } as SpawnSyncOptionsWithStringEncoding
  )

  return treatEOL(diff)
}
