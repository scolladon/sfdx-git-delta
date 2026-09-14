'use strict'
import GitAdapter, {
  type DiffScopeVerdict,
  type DiffSpec,
} from '../adapter/GitAdapter.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION, RENAMED } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'

import { buildIgnoreHelper, type IgnoreHelper } from './ignoreHelper.js'
import { Logger, lazy } from './LoggingService.js'

export type RenamePathPair = Readonly<{ fromPath: string; toPath: string }>

export type HeldAdditionProbeFailure = Readonly<{ candidateCount: number }>

type DeferredDeletion = Readonly<{ line: string; name: string }>

// Filled while the diff streams and resolved only once it is drained: a D
// line can be classified only against every addition name in the diff.
type PendingCancellation = Readonly<{
  additionNames: Set<string>
  heldAdditionNames: Set<string>
  deferredDeletions: DeferredDeletion[]
}>

export default class RepoGitDiff {
  protected readonly gitAdapter: GitAdapter
  private renamePairs: RenamePathPair[] = []
  // The field initialiser only zeroes this once, at construction.
  // getLines() can be called more than once on the same instance (see the
  // renamePairs reset below), so the verdict is reset explicitly at the
  // start of every call rather than relying on the initialiser alone.
  // Stryker disable next-line ObjectLiteral -- equivalent: emptying this initialiser is unobservable. getLines() reassigns both fields to 0 as its first synchronous statement before any await, and the only other consumer, GitAdapter.getUnmatchedSourceScopes, branches solely on `changesSeen > 0` — false for both 0 and undefined
  private readonly diffScopeVerdict: DiffScopeVerdict = {
    changesSeen: 0,
    linesYielded: 0,
  }

  // Set when the `to` listing could not be read while held additions were
  // still pending, so the run can tell the user its move detection was
  // degraded instead of silently falling back to the uncancelled output.
  // Reset per getLines() call, like the verdict above, and read after the
  // diff is drained.
  private probeFailure: HeldAdditionProbeFailure | undefined

  constructor(
    protected readonly config: Config,
    protected readonly metadata: MetadataRepository
  ) {
    this.gitAdapter = GitAdapter.getInstance(this.config)
  }

  /**
   * Streams the filtered, rename-expanded diff lines. Yields A/M lines as
   * they arrive from git so handlers can start working immediately; D
   * lines are buffered until upstream EOF because the deleted-renamed
   * cancellation rule needs the full A-name set — including ignored
   * additions, which are held and resolved against the `to` tree at EOF —
   * before any D line can be classified.
   *
   * Rename pairs are captured along the way and exposed via
   * getRenamePairs() once iteration completes.
   */
  public async *getLines(): AsyncGenerator<string> {
    this._resetRunState()
    const ignoreHelper = await buildIgnoreHelper(this.config)
    const pending: PendingCancellation = {
      additionNames: new Set<string>(),
      heldAdditionNames: new Set<string>(),
      deferredDeletions: [],
    }

    for await (const rawLine of this.gitAdapter.streamDiffLines({
      spec: this.diffSpec(),
      verdict: this.diffScopeVerdict,
      scopes: this.config.source,
    })) {
      for (const expanded of this._expandRename(rawLine)) {
        const streamable = this._routeLine(expanded, ignoreHelper, pending)
        if (streamable !== undefined) yield streamable
      }
    }

    yield* await this._uncancelledDeletions(pending, ignoreHelper)
  }

  private _resetRunState(): void {
    this.renamePairs = []
    this.diffScopeVerdict.changesSeen = 0
    this.diffScopeVerdict.linesYielded = 0
    this.probeFailure = undefined
  }

  // Returns the line when it can stream right away. Additions are recorded
  // (or held, when ignored) and deletions deferred into `pending` instead.
  private _routeLine(
    expanded: string,
    ignoreHelper: IgnoreHelper,
    pending: PendingCancellation
  ): string | undefined {
    // Stryker disable next-line ConditionalExpression -- equivalent: on the false-flip an empty line reaches metadata.has, which rejects it, so the line is dropped (return undefined) either way
    if (!expanded) return undefined
    if (!this.metadata.has(expanded)) return undefined
    if (expanded.startsWith(ADDITION)) {
      return this._routeAddition(expanded, ignoreHelper, pending)
    }
    if (!ignoreHelper.keep(expanded)) return undefined
    if (!expanded.startsWith(DELETION)) return expanded
    // Defer: the D line might cancel against an A line we haven't
    // seen yet (rename-collapse case).
    pending.deferredDeletions.push({
      line: expanded,
      name: this._extractComparisonName(expanded),
    })
    return undefined
  }

  // An ignored addition is held rather than dropped: it may be the
  // destination of a move into the ignore set, which can only be
  // told from a stale copy once the whole diff has been seen.
  private _routeAddition(
    addition: string,
    ignoreHelper: IgnoreHelper,
    pending: PendingCancellation
  ): string | undefined {
    const kept = ignoreHelper.keep(addition)
    const name = this._extractComparisonName(addition)
    if (!kept) {
      pending.heldAdditionNames.add(name)
      return undefined
    }
    pending.additionNames.add(name)
    return addition
  }

  private async _uncancelledDeletions(
    pending: PendingCancellation,
    ignoreHelper: IgnoreHelper
  ): Promise<readonly string[]> {
    const vouching = await this._vouchingHeldNames(
      pending.heldAdditionNames,
      pending.deferredDeletions,
      pending.additionNames,
      ignoreHelper
    )
    if (vouching.size > 0) {
      // A cancelled deletion appears in neither manifest, so without this
      // line a debug run cannot explain why a destructive entry is missing.
      Logger.debug(
        lazy`getLines: held addition(s) '${[...vouching].join("', '")}' survive only under ignored paths at '${this.config.to}', cancelling their deletions`
      )
    }
    return pending.deferredDeletions
      .filter(
        ({ name }) => !pending.additionNames.has(name) && !vouching.has(name)
      )
      .map(({ line }) => line)
  }

  public getRenamePairs(): readonly RenamePathPair[] {
    return this.renamePairs
  }

  // Meaningful only once the diff is drained, like getUnmatchedSourceScopes().
  public getHeldAdditionProbeFailure(): HeldAdditionProbeFailure | undefined {
    return this.probeFailure
  }

  public getUnmatchedSourceScopes(): readonly string[] {
    return this.gitAdapter.getUnmatchedSourceScopes(
      this.diffScopeVerdict,
      this.config.source
    )
  }

  // git emits `R<score>\tfrom\tto` when -M detects a rename. Each rename is
  // expanded into the equivalent D/A pair so every downstream handler keeps
  // operating on a (status, path) tuple; the rename pair is captured for
  // ChangeSet to re-group into its Rename bucket.
  protected *_expandRename(line: string): Iterable<string> {
    // Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: rename branch guard; flipping to false treats every line as a rename and the next `parts.length < 3` check returns the original line for any A/M/D (which has 2 tab-separated parts), preserving the yield+return contract observably
    if (!line.startsWith(RENAMED)) {
      yield line
      return
    }
    const parts = line.split(TAB)
    if (parts.length < 3) {
      yield line
      return
    }
    const fromPath = parts[1]!
    const toPath = parts[2]!
    this.renamePairs.push({ fromPath, toPath })
    yield `${DELETION}${TAB}${fromPath}`
    yield `${ADDITION}${TAB}${toPath}`
  }

  protected _extractComparisonName(line: string) {
    return this.metadata.getFullyQualifiedName(line).toLocaleLowerCase()
  }

  // A held name vouches for its component only when nothing of that
  // component is visible at `to`: a component still alive under an
  // unignored path keeps its deletions, because the ignored copy is then a
  // stale duplicate rather than a move into the ignore set.
  protected async _vouchingHeldNames(
    held: ReadonlySet<string>,
    deferred: readonly DeferredDeletion[],
    registered: ReadonlySet<string>,
    ignoreHelper: IgnoreHelper
  ): Promise<ReadonlySet<string>> {
    // A name a kept addition already registered is cancelled whatever the
    // tree says, so excluding it keeps the read to the names whose answer
    // can still change an outcome.
    const candidates = new Set(
      deferred
        .map(({ name }) => name)
        .filter(name => held.has(name) && !registered.has(name))
    )
    if (candidates.size === 0) return candidates
    const visible = await this._visibleNamesAtTo(candidates, ignoreHelper)
    return new Set([...candidates].filter(name => !visible.has(name)))
  }

  // Visibility is decided by the global ignore, never the destructive one:
  // the question is whether sgd would still treat a file of the component
  // as live source, which is the A/M routing.
  protected async _visibleNamesAtTo(
    candidates: ReadonlySet<string>,
    ignoreHelper: IgnoreHelper
  ): Promise<ReadonlySet<string>> {
    const listing = await this._listFilesAt(this.config.to)
    if (!listing) {
      // Fail closed: a tree that cannot be read lets nothing vouch, so a
      // read failure keeps the uncancelled output rather than silently
      // suppressing a real deletion. Recorded so the run can warn — a
      // degraded result the user never sees is the failure worth avoiding.
      this.probeFailure = { candidateCount: candidates.size }
      Logger.debug(
        lazy`_visibleNamesAtTo: '${this.config.to}' could not be listed, ${candidates.size} candidate component(s) cannot vouch`
      )
      return candidates
    }
    const visible = new Set<string>()
    for (const path of listing) {
      const line = `${ADDITION}${TAB}${path}`
      if (!this.metadata.has(line)) continue
      const name = this._extractComparisonName(line)
      if (candidates.has(name) && ignoreHelper.keep(line)) visible.add(name)
    }
    return visible
  }

  // The one seam that touches git. `undefined` is buildTreeIndex's own
  // failure signal and passes through untouched. Protected so a benchmark
  // can drive the visibility pass over a synthetic listing without a
  // repository, the way the cancellation-key bench reaches the key.
  protected async _listFilesAt(
    revision: string
  ): Promise<readonly string[] | undefined> {
    const index = await this.gitAdapter.buildTreeIndex(
      revision,
      this.config.source
    )
    return index?.getFilesPath(this.config.source)
  }

  // Built fresh on every getLines() call (not cached at construction) so a
  // later rewrite of config.from (ConfigValidator resolves SHAs after
  // RepoGitDiff may already exist) is still visible when the diff runs.
  private diffSpec(): DiffSpec {
    return {
      from: this.config.from,
      to: this.config.to,
      detectRenames: Boolean(this.config.changesManifest),
      ignoreWhitespace: this.config.ignoreWhitespace,
    }
  }
}
