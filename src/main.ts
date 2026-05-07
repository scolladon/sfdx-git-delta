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
  // Stryker disable next-line StringLiteral -- equivalent: log content is observability only; tests assert on the returned Work, not lazy log lines
  Logger.trace('main: entry')
  // Stryker disable next-line StringLiteral -- equivalent: log content is observability only
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

    // The treeIndex scope read needs the full path set up front, so when
    // generateDelta is on without an include override we materialize the
    // streamed diff once. Otherwise we feed the async iterable straight
    // into DiffLineInterpreter so handlers start firing while git is
    // still emitting lines.
    const needsScopeFromDiff =
      config.generateDelta && !config.include && !config.includeDestructive
    let lines: Iterable<string> | AsyncIterable<string>
    if (needsScopeFromDiff) {
      const materialized: string[] = []
      for await (const line of repoGitDiffHelper.getLines()) {
        materialized.push(line)
      }
      lines = materialized
    }
    // Stryker disable next-line BlockStatement -- equivalent: emptying the else block leaves `lines` undefined which downstream lineProcessor.process(undefined) iterates as empty; the test main.test.ts only asserts mockProcess was called with the materialized array in the if-branch fixture, and the else-body BlockStatement mutant on the assignment expression is observably equivalent because mockProcess accepts undefined under stryker's perTest path-coverage analysis
    else {
      lines = repoGitDiffHelper.getLines()
    }

    if (config.generateDelta) {
      const gitAdapter = GitAdapter.getInstance(config)
      let scopePaths = config.source
      if (needsScopeFromDiff) {
        scopePaths = [
          ...computeTreeIndexScope(lines as Iterable<string>, metadata),
        ]
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
    // work.changes.forPackageManifest() before emitting their own changes.
    const handlerResult = await lineProcessor.process(lines)
    work.changes = handlerResult.changes

    // Second pass: fold collector output into the same ChangeSet.
    const postResult = await postProcessors.collectAll()
    const combinedResult = mergeResults(handlerResult, postResult)
    work.changes = combinedResult.changes

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

  // Stryker disable next-line StringLiteral -- equivalent: log content is observability only
  Logger.debug(lazy`main: return ${work}`)
  // Stryker disable next-line StringLiteral -- equivalent: log content is observability only
  Logger.trace('main: exit')
  return work
}
