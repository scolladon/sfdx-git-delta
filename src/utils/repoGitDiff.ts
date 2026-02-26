'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { ADDITION, DELETION } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'

import { buildIgnoreHelper } from './ignoreHelper.js'
import { extractPathFromDiffLine } from './pathNormalizer.js'

export default class RepoGitDiff {
  protected readonly gitAdapter: GitAdapter

  constructor(
    protected readonly config: Config,
    protected readonly metadata: MetadataRepository
  ) {
    this.gitAdapter = GitAdapter.getInstance(this.config)
  }

  public async getLines() {
    const lines = await this.gitAdapter.getDiffLines()
    const treatedLines = await this._treatResult(lines)
    return treatedLines
  }

  protected async _treatResult(lines: string[]): Promise<string[]> {
    const renamedElements = this._getRenamedElements(lines)

    const ignoreHelper = await buildIgnoreHelper(this.config)

    return lines
      .filter(Boolean)
      .filter((line: string) => this._filterInternal(line, renamedElements))
      .filter((line: string) => ignoreHelper.keep(line))
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
    const path = extractPathFromDiffLine(line)
    return !deletedRenamed.has(line) && this.metadata.has(path)
  }

  protected _extractComparisonName(line: string) {
    const path = extractPathFromDiffLine(line)
    return this.metadata.getFullyQualifiedName(path).toLocaleLowerCase()
  }
}
