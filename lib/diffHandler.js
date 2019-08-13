'use strict'
const path = require('path')
const os = require('os')
const childProcess = require('child_process')
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const metadata = require('./metadata/metadata')('directoryName')

const UTF8_ENCODING = 'utf8'
const diffParams = ['diff', '--name-status', '--no-renames']
const revlistParams = ['rev-list', '--max-parents=0', 'HEAD']

module.exports = class DiffHandler {
  constructor(config) {
    this.config = config
    if (!this.config.from) {
      const firstCommitSHARaw = childProcess.spawnSync('git', revlistParams, {
        cwd: this.config.repo,
      }).stdout
      const firstCommitSHA = Buffer.from(firstCommitSHARaw)

      this.config.from = firstCommitSHA.toString(UTF8_ENCODING).trim()
    }
    this.work = {
      config: this.config,
      diffs: {},
      promises: [],
      qwaks: [],
    }
  }

  diff() {
    return new Promise((resolve, reject) => {
      const fullResult = []
      const child = childProcess.spawn(
        'git',
        [...diffParams, this.config.from, this.config.to],
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
}

const treatResult = (fullResult, work) => {
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
