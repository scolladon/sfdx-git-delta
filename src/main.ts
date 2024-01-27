'use strict'
import { MetadataRepository } from './metadata/MetadataRepository'
import { getDefinition } from './metadata/metadataManager'
import { getPostProcessors } from './post-processor/postProcessorManager'
import DiffLineInterpreter from './service/diffLineInterpreter'
import { Config } from './types/config'
import { Work } from './types/work'
import CLIHelper from './utils/cliHelper'
import RepoGitDiff from './utils/repoGitDiff'

const sgd = async (config: Config): Promise<Work> => {
  const work: Work = {
    config,
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
  const cliHelper = new CLIHelper(work)
  await cliHelper.validateConfig()

  const metadata: MetadataRepository = await getDefinition(config.apiVersion)
  const repoGitDiffHelper = new RepoGitDiff(config, metadata)

  const lines = await repoGitDiffHelper.getLines()
  const lineProcessor = new DiffLineInterpreter(work, metadata)
  await lineProcessor.process(lines)
  await getPostProcessors(work, metadata).execute()
  return work
}

export = sgd
