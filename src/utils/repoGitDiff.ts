'use strict'
import GitAdapter from '../adapter/GitAdapter'
import { ADDITION, DELETION } from '../constant/gitConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import type { Config } from '../types/config'

import { IgnoreHelper } from './ignoreHelper'

export default class RepoGitDiff {
  protected readonly gitAdapter: GitAdapter

  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly config: Config,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {
    this.gitAdapter = GitAdapter.getInstance(this.config)
  }

  public async getLines() {
    const lines = await this.gitAdapter.getDiffLines()
    const treatedLines = await this._treatResult(lines)
    return Array.from(new Set([...treatedLines]))
  }

  protected async _treatResult(lines: string[]): Promise<string[]> {
    const renamedElements = this._getRenamedElements(lines)

    const ignoreHelper = await IgnoreHelper.getIgnoreInstance(this.config)

    return lines
      .filter(Boolean)
      .filter((line: string) => this._filterInternal(line, renamedElements))
      .filter((line: string) => ignoreHelper.keep(line))
  }

  protected _getRenamedElements(lines: string[]) {
    const linesPerDiffType: Map<string, string[]> =
      this._spreadLinePerDiffType(lines)
    const AfileNames: Set<string> = new Set(
      linesPerDiffType
        .get(ADDITION)
        ?.map(line => this._extractComparisonName(line)) ?? []
    )
    const deletedRenamed: string[] = [
      ...(linesPerDiffType.get(DELETION) ?? []),
    ].filter((line: string) => {
      const dEl = this._extractComparisonName(line)
      return AfileNames.has(dEl)
    })

    return deletedRenamed
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

  protected _filterInternal(line: string, deletedRenamed: string[]): boolean {
    return !deletedRenamed.includes(line) && this.metadata.has(line)
  }

  protected _extractComparisonName(line: string) {
    return this.metadata.getFullyQualifiedName(line).toLocaleLowerCase()
  }
}
