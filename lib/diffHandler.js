'use strict'
const path = require('path')
const os = require('os')
const childProcess = require('child_process')
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const metadataManager = require('./metadata/metadataManager')

const UTF8_ENCODING = 'utf8'
const fullDiffParams = ['diff', '--name-status', '--no-renames']
const unitDiffParams = ['diff', '--name-status', '-U10000000000']
const revlistParams = ['rev-list', '--max-parents=0', 'HEAD']
const gitConfig = ['config', 'core.quotepath', 'off']

class DiffHandler {
  constructor(config) {
    this.config = config
    childProcess.spawnSync('git', gitConfig, {
      cwd: this.config.repo,
    }).stdout
    if (!this.config.from) {
      const firstCommitSHARaw = childProcess.spawnSync('git', revlistParams, {
        cwd: this.config.repo,
      }).stdout
      const firstCommitSHA = Buffer.from(firstCommitSHARaw)

      this.config.from = firstCommitSHA.toString(UTF8_ENCODING).trim()
    }
    this.work = {
      config: this.config,
      diffs: { package: {}, destructiveChanges: {} },
      promises: [],
      qwaks: [],
    }
  }

  fullDiff() {
    return new Promise((resolve, reject) => {
      const fullResult = []
      const child = childProcess.spawn(
        'git',
        [...fullDiffParams, this.config.from, this.config.to],
        { cwd: this.config.repo }
      )

      child.stdout.on('data', data =>
        fullResult.push(Buffer.from(data).toString(UTF8_ENCODING))
      )
      child.on('close', () => {
        treatResult(fullResult, this.work)
        Promise.all(
          this.work.promises.map(promise =>
            promise.catch(err => this.work.qwaks.push(err))
          )
        ).then(() => resolve(this.work))
      })
      child.stderr.on('data', data =>
        reject(Buffer.from(data).toString(UTF8_ENCODING))
      )
    })
  }

  unitDiff(filePath) {
    return new Promise((resolve, reject) => {
      const fullResult = []

      const child = childProcess.spawn(
        'git',
        [...unitDiffParams, this.config.from, this.config.to, filePath],
        { cwd: this.config.repo }
      )

      child.stdout.on('data', data =>
        fullResult.push(Buffer.from(data).toString(UTF8_ENCODING))
      )
      child.on('close', () => resolve(fullResult.join('')))
      child.stderr.on('data', data =>
        reject(Buffer.from(data).toString(UTF8_ENCODING))
      )
    })
  }
}

DiffHandler.ADDITION_TAG = '+'
DiffHandler.SUPPRESSION_TAG = '-'
module.exports = DiffHandler

const treatResult = (fullResult, work) => {
  const metadata = metadataManager.getDefinition(
    'directoryName',
    work.config.apiVersion
  )
  const typeHandlerFactory = new TypeHandlerFactory(work)
  fullResult
    .join('')
    .split(os.EOL)
    .filter(line =>
      line
        .split(path.sep)
        .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
    )
    .forEach(line => typeHandlerFactory.getTypeHander(line).handle())
}
