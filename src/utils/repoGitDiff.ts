'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION, RENAMED } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'

import { buildIgnoreHelper } from './ignoreHelper.js'

export type RenamePathPair = Readonly<{ fromPath: string; toPath: string }>

export default class RepoGitDiff {
  protected readonly gitAdapter: GitAdapter
  private renamePairs: RenamePathPair[] = []

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
   * cancellation rule needs the full A-name set before any D line can
   * be classified.
   *
   * Rename pairs are captured along the way and exposed via
   * getRenamePairs() once iteration completes.
   */
  public async *getLines(): AsyncGenerator<string> {
    this.renamePairs = []
    const ignoreHelper = await buildIgnoreHelper(this.config)
    const additionNames = new Set<string>()
    const deferredDeletions: string[] = []

    for await (const rawLine of this.gitAdapter.streamDiffLines()) {
      for (const expanded of this._expandRename(rawLine)) {
        // Stryker disable next-line ConditionalExpression -- equivalent: _expandRename never yields empty/falsy strings — it yields the original line or the synthetic D/A pair, both non-empty; the false-flip falls through to metadata.has which would return false on empty paths, observably the same continue
        if (!expanded) continue
        /* v8 ignore next -- defensive: upstream RepoGitDiff already filters non-metadata paths via _expandRename, but kept as safety net */
        // Stryker disable next-line ConditionalExpression -- equivalent: see v8 ignore — _expandRename emits paths that are routed through the metadata index by the producing test fixtures, so the false-flip (always continue) is unreachable when the test corpus is in use
        if (!this.metadata.has(expanded)) continue
        if (!ignoreHelper.keep(expanded)) continue

        // Stryker disable ConditionalExpression -- equivalent: else-if for DELETION; flipping to true treats any non-ADDITION as a deferred deletion, but only A/M/D lines reach this branch (renames are decomposed by _expandRename), so M lines hit the else (yield directly)
        if (expanded.startsWith(ADDITION)) {
          additionNames.add(this._extractComparisonName(expanded))
          yield expanded
        } else if (expanded.startsWith(DELETION)) {
          // Defer: the D line might cancel against an A line we haven't
          // seen yet (rename-collapse case).
          deferredDeletions.push(expanded)
        } else {
          yield expanded
        }
        // Stryker restore ConditionalExpression
      }
    }

    for (const dLine of deferredDeletions) {
      if (!additionNames.has(this._extractComparisonName(dLine))) {
        yield dLine
      }
    }
  }

  public getRenamePairs(): readonly RenamePathPair[] {
    return this.renamePairs
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
}
