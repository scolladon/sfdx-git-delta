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
      .then(work =>
        Promise.all(treatPackages(work.diffs, config)).then(() => work)
      )
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

    Promise.all(
      work.promises.map(promise => promise.catch(err => work.qwaks.push(err)))
    ).then(() => resolve(work))
  })
}

const treatPackages = (dcJson, config) => {
  const pc = new PackageConstructor(config)
  const promises = [DESTRUCTIVE_CHANGES_FILE_NAME, PACKAGE_FILE_NAME].map(op =>
    pc
      .constructPackage(dcJson[op])
      .then(content =>
        fse.outputFileSync(
          path.join(config.output, op, `${op}.${XML_FILE_EXTENSION}`),
          content
        )
      )
  )
  promises.push(
    pc
      .constructPackage({})
      .then(content =>
        fse.outputFileSync(
          path.join(
            config.output,
            DESTRUCTIVE_CHANGES_FILE_NAME,
            `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`
          ),
          content
        )
      )
  )
  return promises
}
