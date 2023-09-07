'use strict'
import { getSpawnContentByLine, treatPathSep } from './childProcessUtils'
import { getType } from './typeUtils'
import { buildIgnoreHelper } from './ignoreHelper'
import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  GIT_COMMAND,
} from './gitConstants'
import {
  SUB_OBJECT_TYPES,
  OBJECT_TYPE,
  OBJECT_TRANSLATION_TYPE,
} from './metadataConstants'
import { SpawnOptionsWithoutStdio } from 'child_process'
import { gitPathSeparatorNormalizer } from './fsHelper'
import { parse, sep } from 'path'
import { MetadataRepository } from '../types/metadata'
import { Config } from '../types/config'

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

const pathType = [OBJECT_TYPE, OBJECT_TRANSLATION_TYPE, ...SUB_OBJECT_TYPES]

export default class RepoGitDiff {
  protected readonly config: Config
  protected readonly metadata: MetadataRepository
  protected readonly spawnConfig: SpawnOptionsWithoutStdio
  protected readonly ignoreWhitespaceParams: string[]

  constructor(config: Config, metadata: MetadataRepository) {
    this.config = config
    this.metadata = metadata
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
    const linesPerDiffType: Map<string, string[]> = lines.reduce(
      (acc: Map<string, string[]>, line: string) => {
        const idx: string = line.charAt(0)
        if (!acc.has(idx)) {
          acc.set(idx, [])
        }
        acc.get(idx)!.push(line)
        return acc
      },
      new Map()
    )
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

    const ignoreHelper = await buildIgnoreHelper(this.config)

    return lines
      .filter(Boolean)
      .filter((line: string) => this._filterInternal(line, deletedRenamed))
      .filter((line: string) => ignoreHelper.keep(line))
  }

  protected _filterInternal(line: string, deletedRenamed: string[]): boolean {
    return (
      !deletedRenamed.includes(line) &&
      line.split(sep).some(part => this.metadata.has(part))
    )
  }

  protected _extractComparisonName(line: string) {
    const type = getType(line, this.metadata)
    const el = parse(line.replace(GIT_DIFF_TYPE_REGEX, ''))
    let comparisonName = el.base
    if (pathType.includes(type)) {
      comparisonName = line
        .split(sep)
        .reduce(
          (acc: string, value: string) =>
            acc || this.metadata.has(value) ? acc + value : acc,
          ''
        )
    }
    return comparisonName
  }
}
