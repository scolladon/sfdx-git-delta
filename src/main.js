'use strict'

const { getDefinition } = require('./metadata/metadataManager')
const DiffLineInterpreter = require('./service/diffLineInterpreter')
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
  const lineProcessor = new DiffLineInterpreter(work, metadata)
  await lineProcessor.process(lines)
  await getPostProcessors(work, metadata).execute()
  return work
}
