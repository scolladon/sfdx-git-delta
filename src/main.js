'use strict'
const PackageConstructor = require('./utils/packageConstructor')
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const metadataManager = require('./metadata/metadataManager')
const CLIHelper = require('./utils/cliHelper')
const RepoGitDiff = require('./utils/repoGitDiff')

const fse = require('fs-extra')
const path = require('path')

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

module.exports = async config => {
  const cliHelper = new CLIHelper(config)
  await cliHelper.validateConfig()

  const metadata = await metadataManager.getDefinition(
    'directoryName',
    config.apiVersion
  )
  const repoGitDiffHelper = new RepoGitDiff(config, metadata)

  const filteredLines = repoGitDiffHelper.getFilteredDiff()
  const includedLines = repoGitDiffHelper.getIncludedFiles()
  const lines = await Promise.all([filteredLines, includedLines])
  const work = await treatDiff(config, lines.flat(), metadata)
  return work
}

const treatDiff = async (config, lines, metadata) => {
  const work = {
    config: config,
    diffs: { package: {}, destructiveChanges: {} },
    warnings: [],
  }

  const typeHandlerFactory = new TypeHandlerFactory(work, metadata)

  await Promise.all(
    lines.map(line => typeHandlerFactory.getTypeHandler(line).handle())
  )
  await treatPackages(work.diffs, config, metadata)
  return work
}

const treatPackages = async (dcJson, config, metadata) => {
  cleanPackages(dcJson)
  const pc = new PackageConstructor(config, metadata)
  await Promise.all(
    [
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
    ].map(async op => {
      const location = path.join(config.output, op.folder, op.filename)
      fse.outputFile(location, op.xmlContent)
    })
  )
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
