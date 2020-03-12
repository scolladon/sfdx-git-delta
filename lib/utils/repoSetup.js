'use strict'
const childProcess = require('child_process')
const gitConstant = require('./gitConstants')

const revlistParams = ['rev-list', '--max-parents=0', 'HEAD']
const gitConfig = ['config', 'core.quotepath', 'off']

module.exports = config => {
  childProcess.spawnSync('git', gitConfig, {
    cwd: config.repo,
  }).stdout
  if (!config.from) {
    const firstCommitSHARaw = childProcess.spawnSync('git', revlistParams, {
      cwd: config.repo,
    }).stdout
    const firstCommitSHA = Buffer.from(firstCommitSHARaw)

    config.from = firstCommitSHA.toString(gitConstant.UTF8_ENCODING).trim()
  }
}
