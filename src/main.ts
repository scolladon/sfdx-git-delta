'use strict'
import { MetadataRepository } from './metadata/MetadataRepository.js'
import { getDefinition } from './metadata/metadataManager.js'
import { getPostProcessors } from './post-processor/postProcessorManager.js'
import DiffLineInterpreter from './service/diffLineInterpreter.js'
import type { Config } from './types/config.js'
import type { Work } from './types/work.js'
import CLIHelper from './utils/cliHelper.js'
import { Logger } from './utils/LoggingService.js'
import RepoGitDiff from './utils/repoGitDiff.js'

export default async (config: Config): Promise<Work> => {
  Logger.trace('main: entry')
  Logger.debug('main: arguments', config)

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

  Logger.debug('main: return', work)
  Logger.trace('main: exit')
  return work
}
