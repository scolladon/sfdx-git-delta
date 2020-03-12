'use strict'
const childProcess = require('child_process')
const gitConstant = require('./gitConstants')

const unitDiffParams = ['diff', '--no-prefix', '-U10000000000']

module.exports = (filePath, config) => {
  return new Promise((resolve, reject) => {
    const fullResult = []

    console.log(config.repo)

    const child = childProcess.spawn(
      'git',
      [...unitDiffParams, config.from, config.to, '--', filePath],
      { cwd: config.repo }
    )

    console.log(child)

    child.stdout.on('data', data =>
      fullResult.push(Buffer.from(data).toString(gitConstant.UTF8_ENCODING))
    )
    child.on('close', () => resolve(fullResult.join('')))
    child.stderr.on('data', data => {
      console.log('error = ' + data)
      reject(Buffer.from(data).toString(gitConstant.UTF8_ENCODING))
    })
  })
}
