'use strict'
const childProcess = require('child_process')
const cpUtils = require('./childProcessUtils')
const gc = require('./gitConstants')
const os = require('os')
const path = require('path')

const fullDiffParams = ['diff', '--name-status', '--no-renames']

module.exports = (config, metadata) => {
  const { stdout: diff } = childProcess.spawnSync(
    'git',
    [...fullDiffParams, config.from, config.to],
    { cwd: config.repo, encoding: gc.UTF8_ENCODING }
  )
  return treatResult(cpUtils.treatDataFromSpawn(diff), metadata)
}

const treatResult = (repoDiffResult, metadata) =>
  repoDiffResult
    .split(os.EOL)
    .filter(line =>
      line
        .split(path.sep)
        .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
    )
