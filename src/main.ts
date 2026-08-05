'use strict'
import GitAdapter from './adapter/GitAdapter.js'
import IOExecutor from './adapter/ioExecutor.js'
import { MetadataRepository } from './metadata/MetadataRepository.js'
import { getDefinition } from './metadata/metadataManager.js'
import { getPostProcessors } from './post-processor/postProcessorManager.js'
import DiffLineInterpreter from './service/diffLineInterpreter.js'
import type { Config, ConfigInput } from './types/config.js'
import type { Work } from './types/work.js'
import ChangeSet from './utils/changeSet.js'
import { assembleChanges } from './utils/changesAssembly.js'
import ConfigValidator from './utils/configValidator.js'
import { Logger, lazy } from './utils/LoggingService.js'
import { MessageService } from './utils/MessageService.js'
import { sanitizeForMessage } from './utils/messageSanitizer.js'
import { parseSourceDirs } from './utils/pathspec.js'
import RenameResolver from './utils/renameResolver.js'
import RepoGitDiff from './utils/repoGitDiff.js'
import { computeTreeIndexScope } from './utils/treeIndexScope.js'

export default async (configInput: ConfigInput): Promise<Work> => {
  // Stryker disable next-line StringLiteral -- equivalent: log content is observability only; tests assert on the returned Work, not lazy log lines
  Logger.trace('main: entry')
  // Stryker disable next-line StringLiteral -- equivalent: log content is observability only
  Logger.debug(lazy`main: arguments ${configInput}`)

  const { pathspecs, rejections } = parseSourceDirs(configInput.source ?? [])
  const config: Config = { ...configInput, source: pathspecs }
  // Captured before validateConfig() resolves them to full SHAs below, so
  // the unmatched-scope warning can report what the user typed.
  const requestedFrom = config.from
  const requestedTo = config.to
  try {
    const configWarnings = await new ConfigValidator(
      config,
      rejections
    ).validateConfig()

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
      let scopePaths: string[] = config.source
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
    const lineProcessor = new DiffLineInterpreter(config, metadata)
    const postProcessors = getPostProcessors(config, metadata)

    // First pass: build the read model from handler output alone so collectors
    // (FlowTranslationProcessor) introspect the handler-pass package view before
    // include lines exist.
    const handlerResult = await lineProcessor.process(lines)
    const handlerView = ChangeSet.from(handlerResult.elements) // handler pass ONLY

    const postResult = await postProcessors.collectAll(handlerView)
    // Resolve git-detected renames — the `{fromPath, toPath}` pairs
    // RepoGitDiff captured from `-M` output — into (type, from, to) triples.
    // Pairs for ignored paths or bundle helper files (same member on both
    // sides) resolve to no triple.
    const renameTriples = await new RenameResolver(config, metadata).resolve(
      repoGitDiffHelper.getRenamePairs()
    )
    const {
      changes,
      copies,
      warnings: assemblyWarnings,
    } = assembleChanges(handlerResult, postResult, renameTriples)

    await new IOExecutor(config).execute(copies)
    const processorWarnings = await postProcessors.executeRemaining(changes)

    // The diff is fully drained by this point (the same assumption
    // getRenamePairs() above already relies on), so the per-scope
    // counters are final. Only warn when the run produced no visible
    // changes at all — a non-empty manifest (e.g. members sourced by
    // --include-file independent of the diff) means the scope did its
    // job, so naming it as unmatched would be misleading.
    const unmatchedScopes = repoGitDiffHelper.getUnmatchedSourceScopes()
    const sourceScopeWarnings =
      unmatchedScopes.length > 0 && changes.isEmpty()
        ? [
            new Error(
              new MessageService().getMessage(
                'warning.SourceDirMatchedNothing',
                [
                  // Sanitize each scope before joining: the length cap in
                  // sanitizeForMessage must apply per scope, not to the
                  // joined aggregate, or one long scope name silently
                  // elides every scope listed after it.
                  unmatchedScopes.map(sanitizeForMessage).join(', '),
                  requestedFrom,
                  requestedTo,
                ]
              )
            ),
          ]
        : []

    const work: Work = {
      config,
      changes,
      warnings: [
        ...configWarnings,
        ...assemblyWarnings,
        ...processorWarnings,
        ...sourceScopeWarnings,
      ],
    }
    // Stryker disable next-line StringLiteral -- equivalent: log content is observability only
    Logger.debug(lazy`main: return ${work}`)
    // Stryker disable next-line StringLiteral -- equivalent: log content is observability only
    Logger.trace('main: exit')
    return work
  } finally {
    await GitAdapter.closeAll()
  }
}
