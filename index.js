'use strict'
const DiffHandler = require('./lib/diffHandler')
const PackageConstructor = require('./lib/packageConstructor')
const FileUtils = require('./lib/utils/fileUtils')
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
  return new Promise((resolve, reject) => {
    const inputError = checkConfig(config)
    if (inputError.length > 0) {
      return reject(new Error(inputError))
    }
    config.apiVersion = parseInt(config.apiVersion)
    const diffHandler = new DiffHandler(config)
    diffHandler
      .diff()
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
