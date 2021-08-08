'use strict'
import { spawnSync, SpawnSyncOptionsWithStringEncoding } from 'child_process'
import { treatEOL } from './childProcessUtils'
import { UTF8_ENCODING } from './gitConstants'
import { Config } from '../model/Config'

const unitDiffParams = ['--no-pager', 'diff', '--no-prefix', '-U200']

export const getFileDiff = (filePath: string, config: Config): string => {
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
