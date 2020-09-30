'use strict'
const PackageConstructor = require('./src/packageConstructor')
const TypeHandlerFactory = require('./src/service/typeHandlerFactory')
const metadataManager = require('./src/metadata/metadataManager')
const repoSetup = require('./src/utils/repoSetup')
const repoGitDiff = require('./src/utils/repoGitDiff')

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
  const inputError = checkConfig(config)
  if (inputError.length > 0) {
    throw new Error(inputError)
  }
  config.apiVersion = parseInt(config.apiVersion)
  repoSetup(config)

  const metadata = metadataManager.getDefinition(
    'directoryName',
    config.apiVersion
  )

  const lines = repoGitDiff(config, metadata)
  const work = treatDiff(config, lines, metadata)
  treatPackages(work.diffs, config, metadata)
  return work
}

const treatDiff = (config, lines, metadata) => {
  const work = {
    config: config,
    diffs: { package: {}, destructiveChanges: {} },
    warnings: [],
  }

  const typeHandlerFactory = new TypeHandlerFactory(work, metadata)

  lines.forEach(line => typeHandlerFactory.getTypeHandler(line).handle())
  return work
}

const treatPackages = (dcJson, config, metadata) => {
  const pc = new PackageConstructor(config, metadata)
  ;[
    {
      filename: `${DESTRUCTIVE_CHANGES_FILE_NAME}.${XML_FILE_EXTENSION}`,
      folder: DESTRUCTIVE_CHANGES_FILE_NAME,
      xmlContent: pc.constructPackage(dcJson[DESTRUCTIVE_CHANGES_FILE_NAME]),
    },
    {
      filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
      folder: PACKAGE_FILE_NAME,
      xmlContent: pc.constructPackage(dcJson[PACKAGE_FILE_NAME]),
    },
    {
      filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
      folder: DESTRUCTIVE_CHANGES_FILE_NAME,
      xmlContent: pc.constructPackage({}),
    },
  ].forEach(op => {
    const location = path.join(config.output, op.folder, op.filename)
    fse.outputFileSync(location, op.xmlContent)
  })
}
