'use strict'
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const metadataManager = require('./metadata/metadataManager')
const CLIHelper = require('./utils/cliHelper')
const RepoGitDiff = require('./utils/repoGitDiff')
const { getPostProcessor } = require('./post-processor/postProcessorManager')

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

  await getPostProcessor(work, config, metadata).process()

  return work
}
