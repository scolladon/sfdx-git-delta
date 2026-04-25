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
        if (!expanded) continue
        if (!this.metadata.has(expanded)) continue
        if (!ignoreHelper.keep(expanded)) continue

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
