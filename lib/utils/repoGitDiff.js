'use strict'
const childProcess = require('child_process')
const cpUtils = require('./childProcessUtils')
const metadataManager = require('../metadata/metadataManager')
const os = require('os')
const path = require('path')

const fullDiffParams = ['diff', '--name-status', '--no-renames']

module.exports = config => {
  const metadata = metadataManager.getDefinition(
    'directoryName',
    config.apiVersion
  )

  return new Promise((resolve, reject) => {
    const diff = []
    const child = childProcess.spawn(
      'git',
      [...fullDiffParams, config.from, config.to],
      { cwd: config.repo }
    )

    child.stdout.on('data', data => diff.push(cpUtils.treatDataFromSpawn(data)))
    child.on('close', () => resolve(treatResult(diff, metadata)))
    child.stderr.on('data', data => reject(cpUtils.treatDataFromSpawn(data)))
  })
}

const treatResult = (repoDiffResult, metadata) =>
  repoDiffResult
    .join('')
    .split(os.EOL)
    .filter(line =>
      line
        .split(path.sep)
        .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
    )
