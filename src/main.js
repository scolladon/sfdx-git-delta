'use strict'
const PackageConstructor = require('./utils/packageConstructor')
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const metadataManager = require('./metadata/metadataManager')
const CLIHelper = require('./utils/cliHelper')
const repoGitDiff = require('./utils/repoGitDiff')

const fse = require('fs-extra')
const path = require('path')

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

module.exports = config => {
  const cliHelper = new CLIHelper(config)
  cliHelper.validateConfig()

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
  cleanPackages(dcJson)
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

const cleanPackages = dcJson => {
  const additive = dcJson[PACKAGE_FILE_NAME]
  const destructive = dcJson[DESTRUCTIVE_CHANGES_FILE_NAME]
  Object.keys(additive)
    .filter(type => Object.prototype.hasOwnProperty.call(destructive, type))
    .forEach(
      type =>
        (destructive[type] = new Set(
          [...destructive[type]].filter(element => !additive[type].has(element))
        ))
    )
}
