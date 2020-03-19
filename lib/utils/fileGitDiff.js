'use strict'
const childProcess = require('child_process')
const cpUtils = require('./childProcessUtils')

const unitDiffParams = ['diff', '--no-prefix', '-U10000000000']

module.exports = (filePath, config) => {
  return new Promise((resolve, reject) => {
    const diff = []

    const child = childProcess.spawn(
      'git',
      [...unitDiffParams, config.from, config.to, '--', filePath],
      { cwd: config.repo }
    )

    child.stdout.on('data', data => diff.push(cpUtils.treatDataFromSpawn(data)))
    child.on('close', () => resolve(diff.join('')))
    child.stderr.on('data', data => reject(cpUtils.treatDataFromSpawn(data)))
  })
}
