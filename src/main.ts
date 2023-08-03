'use strict'
import DiffLineInterpreter from './service/diffLineInterpreter'
import { getDefinition } from './metadata/metadataManager'
import CLIHelper from './utils/cliHelper'
import RepoGitDiff from './utils/repoGitDiff'
import { getPostProcessors } from './post-processor/postProcessorManager'

export const sgd = async (config: any) => {
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
