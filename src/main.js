'use strict'
const PackageConstructor = require('./utils/packageConstructor')
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const metadataManager = require('./metadata/metadataManager')
const CLIHelper = require('./utils/cliHelper')
const RepoGitDiff = require('./utils/repoGitDiff')

const { outputFile } = require('fs-extra')
const { join } = require('path')

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

  const lines = await repoGitDiffHelper.getLines()
  const work = await treatDiff(config, lines, metadata)
  return work
}

const treatDiff = async (config, lines, metadata) => {
  const work = {
    config: config,
    diffs: { package: new Map(), destructiveChanges: new Map() },
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
        xmlContent: pc.constructPackage(new Map()),
      },
    ].map(async op => {
      const location = join(config.output, op.folder, op.filename)
      outputFile(location, op.xmlContent)
    })
  )
}

const cleanPackages = dcJson => {
  const additive = dcJson[PACKAGE_FILE_NAME]
  const destructive = dcJson[DESTRUCTIVE_CHANGES_FILE_NAME]
  for (const [type, members] of additive) {
    if (destructive.has(type)) {
      destructive.set(
        type,
        new Set(
          [...destructive.get(type)].filter(element => !members.has(element))
        )
      )
    }
  }
}
