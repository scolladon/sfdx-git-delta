'use strict'
import { MetadataRepository } from './metadata/MetadataRepository.js'
import { getDefinition } from './metadata/metadataManager.js'
import { getPostProcessors } from './post-processor/postProcessorManager.js'
import DiffLineInterpreter from './service/diffLineInterpreter.js'
import IOExecutor from './service/ioExecutor.js'
import type { Config } from './types/config.js'
import { mergeResults } from './types/handlerResult.js'
import type { Work } from './types/work.js'
import CLIHelper from './utils/cliHelper.js'
import { Logger, lazy } from './utils/LoggingService.js'
import { aggregateManifests } from './utils/manifestAggregator.js'
import RepoGitDiff from './utils/repoGitDiff.js'

export default async (config: Config): Promise<Work> => {
  Logger.trace('main: entry')
  Logger.debug(lazy`main: arguments ${config}`)

  const work: Work = {
    config,
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
  const cliHelper = new CLIHelper(work)
  await cliHelper.validateConfig()

  const metadata: MetadataRepository = await getDefinition(config)
  const repoGitDiffHelper = new RepoGitDiff(config, metadata)

  const lines = await repoGitDiffHelper.getLines()
  const lineProcessor = new DiffLineInterpreter(work, metadata)
  const postProcessors = getPostProcessors(work, metadata)

  const handlerResult = await lineProcessor.processAndCollect(lines)
  const postResult = await postProcessors.collectAll()
  const combinedResult = mergeResults(handlerResult, postResult)

  work.diffs = aggregateManifests(combinedResult)
  work.warnings.push(...combinedResult.warnings)

  await new IOExecutor(config).execute(combinedResult.copies)
  await postProcessors.executeRemaining()

  Logger.debug(lazy`main: return ${work}`)
  Logger.trace('main: exit')
  return work
}
