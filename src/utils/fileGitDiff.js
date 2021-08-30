'use strict'
const childProcess = require('child_process')
const cpUtils = require('./childProcessUtils')
const gc = require('./gitConstants')

const unitDiffParams = ['--no-pager', 'diff', '--no-prefix', '-U200']

module.exports = (filePath, config) => {
  const permissiveDiffParams = config.permissiveDiff
    ? gc.PERMISSIVE_DIFF_PARAMS
    : []
  const { stdout: diff } = childProcess.spawnSync(
    'git',
    [
      ...unitDiffParams,
      ...permissiveDiffParams,
      config.from,
      config.to,
      '--',
      filePath,
    ],
    { cwd: config.repo, encoding: gc.UTF8_ENCODING }
  )

  return cpUtils.treatEOL(diff)
}
