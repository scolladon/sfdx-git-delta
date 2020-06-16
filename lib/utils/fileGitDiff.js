'use strict'
const childProcess = require('child_process')
const cpUtils = require('./childProcessUtils')
const gc = require('./gitConstants')

const unitDiffParams = ['diff', '--no-prefix', '-U10000000000']

module.exports = (filePath, config) => {
  const { stdout: diff } = childProcess.spawnSync(
    'git',
    [...unitDiffParams, config.from, config.to, '--', filePath],
    { cwd: config.repo, encoding: gc.UTF8_ENCODING }
  )

  return cpUtils.treatDataFromSpawn(diff)
}
