'use strict'
const FileUtils = require('./lib/utils/fileUtils')
const PackageConstructor = require('./lib/packageConstructor')
const TypeHandlerFactory = require('./lib/service/typeHandlerFactory')
const repoSetup = require('./lib/utils/repoSetup')
const repoGitDiff = require('./lib/utils/repoGitDiff')

const git = require('git-state')
const fs = require('fs')

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

const checkConfig = config => {
  const errors = []
  if (typeof config.to !== 'string') {
    errors.push(`to ${config.to} is not a sha`)
  }
  if (isNaN(config.apiVersion)) {
    errors.push(`api-version ${config.apiVersion} is not a number`)
  }
  if (
    !fs.existsSync(config.output) ||
    !fs.statSync(config.output).isDirectory()
  ) {
    errors.push(`${config.output} folder does not exist`)
  }

  if (!git.isGitSync(config.repo)) {
    errors.push(`${config.repo} is not a git repository`)
  }

  return errors
}

module.exports = config => {
  const treatDiff = lines => {
    return new Promise(resolve => {
      const work = {
        config: config,
        diffs: { package: {}, destructiveChanges: {} },
        promises: [],
        qwaks: [],
      }

      const typeHandlerFactory = new TypeHandlerFactory(work)

      lines.forEach(line => typeHandlerFactory.getTypeHandler(line).handle())

      Promise.all(
        work.promises.map(promise => promise.catch(err => work.qwaks.push(err)))
      ).then(() => resolve(work))
    })
  }
  return new Promise((resolve, reject) => {
    const inputError = checkConfig(config)
    if (inputError.length > 0) {
      return reject(new Error(inputError))
    }
    config.apiVersion = parseInt(config.apiVersion)
    repoSetup(config)

    repoGitDiff(config)
      .then(treatDiff)
      .then(work =>
        Promise.all(treatPackages(work.diffs, config)).then(() => work)
      )
      .then(work => resolve(work.qwaks))
      .catch(err => reject(err))
  })
}

const treatPackages = (dcJson, config) => {
  const pc = new PackageConstructor(config)
  const fu = new FileUtils(config)
  return [DESTRUCTIVE_CHANGES_FILE_NAME, PACKAGE_FILE_NAME].map(op =>
    pc
      .constructPackage(dcJson[op])
      .then(content =>
        fu.writeChangesAsync(content, `${op}.${XML_FILE_EXTENSION}`)
      )
  )
}
