'use strict'
const childProcess = require('child_process')
const gitConstant = require('./gitConstants')
const metadataManager = require('../metadata/metadataManager')
const os = require('os')
const path = require('path')

const fullDiffParams = ['diff', '--name-status', '--no-renames']

module.exports = config => {
  const metadata = metadataManager.getDefinition(
    'directoryName',
    config.apiVersion
  )
  const treatResult = fullResult =>
    fullResult
      .join('')
      .split(os.EOL)
      .filter(line =>
        line
          .split(path.sep)
          .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
      )

  return new Promise((resolve, reject) => {
    const fullResult = []
    const child = childProcess.spawn(
      'git',
      [...fullDiffParams, config.from, config.to],
      { cwd: config.repo }
    )

    child.stdout.on('data', data =>
      fullResult.push(Buffer.from(data).toString(gitConstant.UTF8_ENCODING))
    )
    child.on('close', () => {
      resolve(treatResult(fullResult))
    })
    child.stderr.on('data', data =>
      reject(Buffer.from(data).toString(gitConstant.UTF8_ENCODING))
    )
  })
}
