'use strict'
import GitAdapter from './adapter/GitAdapter.js'
import IOExecutor from './adapter/ioExecutor.js'
import { MetadataRepository } from './metadata/MetadataRepository.js'
import { getDefinition } from './metadata/metadataManager.js'
import { getPostProcessors } from './post-processor/postProcessorManager.js'
import DiffLineInterpreter from './service/diffLineInterpreter.js'
import type { Config, ConfigInput } from './types/config.js'
import type { RunContext } from './types/runContext.js'
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
import { buildRunTreeReader } from './utils/treeReaderBuilder.js'

const collectLines = async (
  lines: AsyncIterable<string>
): Promise<string[]> => {
  const materialized: string[] = []
  for await (const line of lines) {
    materialized.push(line)
  }
  return materialized
}

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

    // The tree-index scope is read off the diff whenever no include file
    // overrides it, so the stream is materialised once: computeTreeIndexScope
    // and lineProcessor.process walk the same lines. With an include file the
    // scope is config.source and the async iterable feeds straight into
    // DiffLineInterpreter, so handlers fire while git is still emitting.
    const needsScopeFromDiff = !config.include && !config.includeDestructive
    const materialized = needsScopeFromDiff
      ? await collectLines(repoGitDiffHelper.getLines())
      : undefined
    const lines = materialized ?? repoGitDiffHelper.getLines()

    // The manifests must not depend on --generate-delta: every index-backed
    // read that decides package.xml vs destructiveChanges.xml (container
    // liveness, decomposed-holder liveness, the include listing) runs in
    // every mode, so the run's two indexes are built in every mode. The flag
    // gates only what is copied. Built here and threaded to every reader
    // (DiffLineInterpreter, RenameResolver, IOExecutor, the post-processors)
    // through RunContext rather than cached on GitAdapter, so no reader can
    // see a different scope than the one this run built under.
    const scopePaths: readonly string[] = materialized
      ? [...computeTreeIndexScope(materialized, metadata)]
      : config.source
    const { trees, unindexed } = await buildRunTreeReader(
      GitAdapter.getInstance(config),
      config,
      scopePaths
    )
    const ctx: RunContext = { config, metadata, trees }

    const lineProcessor = new DiffLineInterpreter(ctx)
    const postProcessors = getPostProcessors(ctx)

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
    const renameTriples = await new RenameResolver(ctx).resolve(
      repoGitDiffHelper.getRenamePairs()
    )
    const {
      changes,
      copies,
      warnings: assemblyWarnings,
    } = assembleChanges(handlerResult, postResult, renameTriples)

    await new IOExecutor(ctx).execute(copies)
    const processorWarnings = await postProcessors.executeRemaining(changes)

    // The diff is fully drained by this point (the same assumption
    // getRenamePairs() above already relies on), so the per-scope
    // counters are final. Only warn when the run produced no visible
    // changes at all — a non-empty manifest (e.g. members sourced by
    // --include-file independent of the diff) means the scope did its
    // job, so naming it as unmatched would be misleading.
    const messages = new MessageService()
    // tokens is a thunk, not a precomputed array: sanitizeForMessage must
    // only run when the warning actually fires, matching the ternaries this
    // replaces (some callers never set config.to/from, so an unconditional
    // sanitizeForMessage(requestedTo) would crash on undefined).
    const warnIf = (
      condition: boolean,
      key: string,
      tokens: () => string[]
    ): Error[] =>
      condition ? [new Error(messages.getMessage(key, tokens()))] : []

    const unmatchedScopes = repoGitDiffHelper.getUnmatchedSourceScopes()
    const sourceScopeWarnings = warnIf(
      unmatchedScopes.length > 0 && changes.isEmpty(),
      'warning.SourceDirMatchedNothing',
      () => [
        // Sanitize each scope before joining: the length cap in
        // sanitizeForMessage must apply per scope, not to the
        // joined aggregate, or one long scope name silently
        // elides every scope listed after it.
        unmatchedScopes.map(sanitizeForMessage).join(', '),
        sanitizeForMessage(requestedFrom),
        sanitizeForMessage(requestedTo),
      ]
    )

    // Also final by this point. When the `to` listing could not be read,
    // components moved into an ignored directory were not recognised as
    // moves, so their deletions are reported destructively. That is the
    // safe direction, but it is a degraded answer and must not be silent.
    const probeFailure = repoGitDiffHelper.getHeldAdditionProbeFailure()
    const ignoredMoveWarnings = warnIf(
      !!probeFailure,
      'warning.IgnoredMoveCheckSkipped',
      // Non-null: this thunk only runs when warnIf's condition (!!probeFailure)
      // is true, but the closure sits outside TS's narrowing of that check.
      () => [
        sanitizeForMessage(requestedTo),
        probeFailure!.candidateCount.toString(),
      ]
    )

    // Known as soon as the tree reader is built, but raised here with the
    // rest of the warnings for a single review point. Only `to` is
    // warn-worthy: it is the revision every liveness read (pathExists,
    // readDirs) resolves through, so its degrade is what lets a live
    // container land in destructiveChanges.xml. `from` only feeds deep-path
    // member-name resolution, a narrower and already-attributed effect.
    const treeIndexWarnings = warnIf(
      unindexed.includes(config.to),
      'warning.TreeIndexUnavailable',
      () => [sanitizeForMessage(requestedTo)]
    )

    const work: Work = {
      config,
      changes,
      warnings: [
        ...configWarnings,
        ...assemblyWarnings,
        ...processorWarnings,
        ...sourceScopeWarnings,
        ...ignoredMoveWarnings,
        ...treeIndexWarnings,
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
