'use strict'
import PackageConstructor from './utils/packageConstructor'
import TypeHandlerFactory from './service/typeHandlerFactory'
import MetadataManager from './metadata/metadataManager'
import CLIHelper from './utils/cliHelper'
import { Config } from './model/Config'
import { Deploy, Result } from './model/Result'
import { getDiff } from './utils/repoGitDiff'

import { outputFileSync } from 'fs-extra'
import { join } from 'path'
import { MetadataRepository } from './model/Metadata'

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

export const execute = (config: Config): Result => {
  const cliHelper = new CLIHelper(config)
  cliHelper.validateConfig()

  const metadataManager = new MetadataManager()
  const metadata = metadataManager.getDefinition(
    'directoryName',
    config.apiVersion
  )

  const lines = getDiff(config, metadata)
  const work = treatDiff(config, lines, metadata)
  treatPackages(work.diffs, config, metadata)
  return work
}

const treatDiff = (
  config: Config,
  lines: Array<string>,
  metadata: MetadataRepository
): Result => {
  const work: Result = {
    config: config,
    diffs: { package: {}, destructiveChanges: {} },
    warnings: [],
  }

  const typeHandlerFactory: TypeHandlerFactory = new TypeHandlerFactory(
    work,
    metadata
  )

  lines.forEach((line: string) =>
    typeHandlerFactory.getTypeHandler(line).handle()
  )
  return work
}

const treatPackages = (
  dcJson: Deploy,
  config: Config,
  metadata: MetadataRepository
) => {
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
    const location = join(config.output, op.folder, op.filename)
    outputFileSync(location, op.xmlContent)
  })
}

const cleanPackages = (dcJson: Deploy) => {
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
