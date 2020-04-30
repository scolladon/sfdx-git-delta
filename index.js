'use strict'
const PackageConstructor = require('./lib/packageConstructor')
const TypeHandlerFactory = require('./lib/service/typeHandlerFactory')
const metadataManager = require('./lib/metadata/metadataManager')
const repoSetup = require('./lib/utils/repoSetup')
const repoGitDiff = require('./lib/utils/repoGitDiff')

const fs = require('fs')
const fse = require('fs-extra')
const git = require('git-state')
const path = require('path')

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
    repoSetup(config)

    const metadata = metadataManager.getDefinition(
      'directoryName',
      config.apiVersion
    )

    repoGitDiff(config, metadata)
      .then(lines => treatDiff(config, lines, metadata))
      .then(work => treatPackages(work.diffs, config).then(() => work))
      .then(work => resolve(work.qwaks))
      .catch(reject)
  })
}

const treatDiff = (config, lines, metadata) => {
  return new Promise(resolve => {
    const work = {
      config: config,
      diffs: { package: {}, destructiveChanges: {} },
      promises: [],
      qwaks: [],
    }

    const typeHandlerFactory = new TypeHandlerFactory(work, metadata)

    lines.forEach(line => typeHandlerFactory.getTypeHandler(line).handle())
    work.promises
      .map(promise => promise.catch(err => work.qwaks.push(err)))
      .reduce(
        (promiseChain, nextPromise) => promiseChain.then(nextPromise),
        Promise.resolve()
      )
      .then(() => resolve(work))
  })
}

const treatPackages = (dcJson, config) => {
  const pc = new PackageConstructor(config)
  return [
    {
      filename: DESTRUCTIVE_CHANGES_FILE_NAME,
      folder: DESTRUCTIVE_CHANGES_FILE_NAME,
      jsonContent: dcJson[DESTRUCTIVE_CHANGES_FILE_NAME],
    },
    {
      filename: PACKAGE_FILE_NAME,
      folder: PACKAGE_FILE_NAME,
      jsonContent: dcJson[PACKAGE_FILE_NAME],
    },
    {
      filename: PACKAGE_FILE_NAME,
      folder: DESTRUCTIVE_CHANGES_FILE_NAME,
      jsonContent: {},
    },
  ].reduce(
    (promiseChain, op) => promiseChain.then(() => treatPackage(op, pc, config)),
    Promise.resolve()
  )
}

const treatPackage = (op, pc, config) => {
  return pc
    .constructPackage(op.jsonContent)
    .then(content =>
      fse.outputFileSync(
        path.join(
          config.output,
          op.folder,
          `${op.filename}.${XML_FILE_EXTENSION}`
        ),
        content
      )
    )
}
