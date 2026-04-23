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

  public async getLines(): Promise<string[]> {
    const rawLines = await this.gitAdapter.getDiffLines()
    const expanded = this._expandRenames(rawLines)
    return await this._treatResult(expanded)
  }

  public getRenamePairs(): readonly RenamePathPair[] {
    return this.renamePairs
  }

  // git emits `R<score>\tfrom\tto` when -M detects a rename. We split each
  // rename into the equivalent pair of A/D lines so every downstream handler
  // continues to operate on a (status, path) tuple; the rename pair is
  // captured separately for ChangeSet to re-group into its Rename bucket.
  protected _expandRenames(lines: string[]): string[] {
    this.renamePairs = []
    const expanded: string[] = []
    for (const line of lines) {
      if (!line.startsWith(RENAMED)) {
        expanded.push(line)
        continue
      }
      const parts = line.split(TAB)
      if (parts.length < 3) {
        expanded.push(line)
        continue
      }
      const fromPath = parts[1]!
      const toPath = parts[2]!
      this.renamePairs.push({ fromPath, toPath })
      expanded.push(`${DELETION}${TAB}${fromPath}`)
      expanded.push(`${ADDITION}${TAB}${toPath}`)
    }
    return expanded
  }

  protected async _treatResult(lines: string[]): Promise<string[]> {
    const renamedElements = this._getRenamedElements(lines)

    const ignoreHelper = await buildIgnoreHelper(this.config)

    return lines.filter(
      (line: string) =>
        Boolean(line) &&
        this._filterInternal(line, renamedElements) &&
        ignoreHelper.keep(line)
    )
  }

  protected _getRenamedElements(lines: string[]): Set<string> {
    const linesPerDiffType: Map<string, string[]> =
      this._spreadLinePerDiffType(lines)
    const AfileNames: Set<string> = new Set(
      linesPerDiffType
        .get(ADDITION)
        ?.map(line => this._extractComparisonName(line)) ?? []
    )
    const deletedRenamed = (linesPerDiffType.get(DELETION) ?? []).filter(
      (line: string) => {
        const dEl = this._extractComparisonName(line)
        return AfileNames.has(dEl)
      }
    )

    return new Set(deletedRenamed)
  }
  protected _spreadLinePerDiffType(lines: string[]) {
    return lines.reduce((acc: Map<string, string[]>, line: string) => {
      const idx: string = line.charAt(0)
      if (!acc.has(idx)) {
        acc.set(idx, [])
      }
      acc.get(idx)!.push(line)
      return acc
    }, new Map())
  }

  protected _filterInternal(
    line: string,
    deletedRenamed: Set<string>
  ): boolean {
    return !deletedRenamed.has(line) && this.metadata.has(line)
  }

  protected _extractComparisonName(line: string) {
    return this.metadata.getFullyQualifiedName(line).toLocaleLowerCase()
  }
}
