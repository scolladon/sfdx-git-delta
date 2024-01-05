'use strict'
import { getSpawnContentByLine, treatPathSep } from './childProcessUtils'
import { buildIgnoreHelper } from './ignoreHelper'
import {
  ADDITION,
  DELETION,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  GIT_COMMAND,
} from './gitConstants'
import { SpawnOptionsWithoutStdio } from 'child_process'
import { gitPathSeparatorNormalizer } from './fsHelper'
import { Config } from '../types/config'
import { MetadataRepository } from '../metadata/MetadataRepository'

const DIFF_FILTER = '--diff-filter'

const fullDiffParams = ['--no-pager', 'diff', '--numstat', '--no-renames']
const filterDeleted = [`${DIFF_FILTER}=${DELETION}`]
const filterAdded = [`${DIFF_FILTER}=${ADDITION}`]
const filterModification = [`${DIFF_FILTER}=${MODIFICATION}`]
const TAB = '\t'
const NUM_STAT_REGEX = /^((-|\d+)\t){2}/
const lcSensitivity: Intl.CollatorOptions = {
  sensitivity: 'accent',
}

export default class RepoGitDiff {
  protected readonly spawnConfig: SpawnOptionsWithoutStdio
  protected readonly ignoreWhitespaceParams: string[]

  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly config: Config,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {
    this.spawnConfig = {
      cwd: this.config.repo,
    }
    this.ignoreWhitespaceParams = this.config.ignoreWhitespace
      ? IGNORE_WHITESPACE_PARAMS
      : []
  }

  public async getLines() {
    const lines = await this._getFilteredDiff()
    return Array.from(new Set([...lines.flat().filter(Boolean)]))
  }

  protected async _getFilteredDiff() {
    const lines = await Promise.all([
      this._spawnGitDiff(filterAdded, ADDITION),
      this._spawnGitDiff(filterDeleted, DELETION),
      this._spawnGitDiff(filterModification, MODIFICATION),
    ])
    const treatedLines = await this._treatResult(lines.flat())
    return treatedLines
  }

  protected async _spawnGitDiff(
    filter: string[],
    changeType: string
  ): Promise<string[]> {
    const diffContent = await getSpawnContentByLine(
      GIT_COMMAND,
      [
        ...fullDiffParams,
        ...filter,
        ...this.ignoreWhitespaceParams,
        this.config.from,
        this.config.to,
        gitPathSeparatorNormalizer(this.config.source),
      ],
      this.spawnConfig
    )

    return diffContent.map(line =>
      treatPathSep(line).replace(NUM_STAT_REGEX, `${changeType}${TAB}`)
    )
  }

  protected async _treatResult(lines: string[]): Promise<string[]> {
    const renamedElements = this._getRenamedElements(lines)

    const ignoreHelper = await buildIgnoreHelper(this.config)

    return lines
      .filter(Boolean)
      .filter((line: string) => this._filterInternal(line, renamedElements))
      .filter((line: string) => ignoreHelper.keep(line))
  }

  protected _getRenamedElements(lines: string[]) {
    const linesPerDiffType: Map<string, string[]> =
      this._spreadLinePerDiffType(lines)
    const AfileNames: string[] =
      linesPerDiffType
        .get(ADDITION)
        ?.map(line => this._extractComparisonName(line)) ?? []
    const deletedRenamed: string[] =
      linesPerDiffType.get(DELETION)?.filter((line: string) => {
        const dEl = this._extractComparisonName(line)
        return AfileNames.some(
          aEl => !aEl.localeCompare(dEl, undefined, lcSensitivity)
        )
      }) ?? []

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
    return this.metadata.getFullyQualifiedName(line)
  }
}
