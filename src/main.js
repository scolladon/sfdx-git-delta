'use strict'
const TypeHandlerFactory = require('./service/typeHandlerFactory')
const { getDefinition } = require('./metadata/metadataManager')
const CLIHelper = require('./utils/cliHelper')
const RepoGitDiff = require('./utils/repoGitDiff')
const { getPostProcessors } = require('./post-processor/postProcessorManager')

module.exports = async config => {
  const work = {
    config: config,
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
  const cliHelper = new CLIHelper(work)
  await cliHelper.validateConfig()

  const metadata = await getDefinition('directoryName', config.apiVersion)
  const repoGitDiffHelper = new RepoGitDiff(config, metadata)

  const lines = await repoGitDiffHelper.getLines()
  await treatDiff(work, lines, metadata)
  return work
}

const treatDiff = async (work, lines, metadata) => {
  const typeHandlerFactory = new TypeHandlerFactory(work, metadata)

  for (const line of lines) {
    await typeHandlerFactory.getTypeHandler(line).handle()
  }

  await getPostProcessors(work, metadata).execute()
}
