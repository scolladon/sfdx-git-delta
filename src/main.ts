'use strict'
import GitAdapter from './adapter/GitAdapter.js'
import IOExecutor from './adapter/ioExecutor.js'
import { MetadataRepository } from './metadata/MetadataRepository.js'
import { getDefinition } from './metadata/metadataManager.js'
import { getPostProcessors } from './post-processor/postProcessorManager.js'
import DiffLineInterpreter from './service/diffLineInterpreter.js'
import type { Config } from './types/config.js'
import { mergeResults } from './types/handlerResult.js'
import type { Work } from './types/work.js'
import { pushAll } from './utils/arrayUtils.js'
import ChangeSet from './utils/changeSet.js'
import ConfigValidator from './utils/configValidator.js'
import { Logger, lazy } from './utils/LoggingService.js'
import RenameResolver from './utils/renameResolver.js'
import RepoGitDiff from './utils/repoGitDiff.js'
import { computeTreeIndexScope } from './utils/treeIndexScope.js'

export default async (config: Config): Promise<Work> => {
  Logger.trace('main: entry')
  Logger.debug(lazy`main: arguments ${config}`)

  const work: Work = {
    config,
    changes: new ChangeSet(),
    warnings: [],
  }
  try {
    const configValidator = new ConfigValidator(work)
    await configValidator.validateConfig()

    const metadata: MetadataRepository = await getDefinition(config)
    const repoGitDiffHelper = new RepoGitDiff(config, metadata)

    const lines = await repoGitDiffHelper.getLines()
    if (config.generateDelta) {
      const gitAdapter = GitAdapter.getInstance(config)
      let scopePaths = config.source
      if (!config.include && !config.includeDestructive) {
        scopePaths = [...computeTreeIndexScope(lines, metadata)]
      }
      if (scopePaths.length > 0) {
        await Promise.all([
          gitAdapter.preBuildTreeIndex(config.to, scopePaths),
          gitAdapter.preBuildTreeIndex(config.from, scopePaths),
        ])
      }
    }
    const lineProcessor = new DiffLineInterpreter(work, metadata)
    const postProcessors = getPostProcessors(work, metadata)

    // First pass: build the ChangeSet from handler output so collectors
    // (e.g. FlowTranslationProcessor) can introspect the package view via
    // work.changes.forPackageManifest() before emitting their own manifests.
    const handlerResult = await lineProcessor.process(lines)
    work.changes = ChangeSet.from(handlerResult.manifests)

    // Second pass: rebuild once collector output is merged in.
    const postResult = await postProcessors.collectAll()
    const combinedResult = mergeResults(handlerResult, postResult)
    work.changes = ChangeSet.from(combinedResult.manifests)

    // Apply git-detected renames: resolve the `{fromPath, toPath}` pairs that
    // RepoGitDiff captured from `-M` output into (type, from, to) triples and
    // re-group them into the ChangeSet's rename bucket. Pairs for ignored
    // paths or bundle helper files (same member on both sides) are no-ops.
    await new RenameResolver(work, metadata).apply(
      work.changes,
      repoGitDiffHelper.getRenamePairs()
    )

    pushAll(work.warnings, combinedResult.warnings)

    await new IOExecutor(config).execute(combinedResult.copies)
    await postProcessors.executeRemaining()
  } finally {
    GitAdapter.closeAll()
  }

  Logger.debug(lazy`main: return ${work}`)
  Logger.trace('main: exit')
  return work
}
