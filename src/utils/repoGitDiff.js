'use strict'
const { linify, treatPathSep } = require('./childProcessUtils')
const { getType } = require('./typeUtils')
const { buildIgnoreHelper } = require('./ignoreHelper')
const {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  UTF8_ENCODING,
  GIT_COMMAND,
} = require('./gitConstants')
const {
  SUB_OBJECT_TYPES,
  OBJECT_TYPE,
  OBJECT_TRANSLATION_TYPE,
} = require('./metadataConstants')
const { spawn } = require('child_process')
const { gitPathSeparatorNormalizer } = require('./fsHelper')
const { parse, sep } = require('path')

const DIFF_FILTER = '--diff-filter'

const fullDiffParams = ['--no-pager', 'diff', '--numstat', '--no-renames']
const filterDeleted = [`${DIFF_FILTER}=${DELETION}`]
const filterAdded = [`${DIFF_FILTER}=${ADDITION}`]
const filterModification = [`${DIFF_FILTER}=${MODIFICATION}`]
const TAB = '\t'
const NUM_STAT_REGEX = /^((-|\d+)\t){2}/
const lcSensitivity = {
  sensitivity: 'accent',
}

const pathType = [OBJECT_TYPE, OBJECT_TRANSLATION_TYPE, ...SUB_OBJECT_TYPES]
class RepoGitDiff {
  constructor(config, metadata) {
    this.config = config
    this.metadata = metadata
    this.spawnConfig = {
      cwd: this.config.repo,
      encoding: UTF8_ENCODING,
    }
    this.ignoreWhitespaceParams = this.config.ignoreWhitespace
      ? IGNORE_WHITESPACE_PARAMS
      : []
  }

  async getLines() {
    const lines = await this._getFilteredDiff()
    return Array.from(new Set([...lines.flat().filter(Boolean)]))
  }

  async _getFilteredDiff() {
    const lines = await Promise.all([
      this._spawnGitDiff(filterAdded, ADDITION),
      this._spawnGitDiff(filterDeleted, DELETION),
      this._spawnGitDiff(filterModification, MODIFICATION),
    ])
    const treatedLines = await this._treatResult(lines.flat())
    return treatedLines
  }

  async _spawnGitDiff(filter, changeType) {
    const lines = []
    const gitDiff = spawn(
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
    for await (const line of linify(gitDiff.stdout)) {
      lines.push(
        treatPathSep(line).replace(NUM_STAT_REGEX, `${changeType}${TAB}`)
      )
    }
    return lines
  }

  async _treatResult(lines) {
    const linesPerDiffType = lines.reduce(
      (acc, line) => (acc[line.charAt(0)]?.push(line), acc),
      { [ADDITION]: [], [DELETION]: [] }
    )
    const AfileNames = linesPerDiffType[ADDITION].map(line =>
      this._extractComparisonName(line)
    )
    const deletedRenamed = linesPerDiffType[DELETION].filter(line => {
      const dEl = this._extractComparisonName(line)
      return AfileNames.some(
        aEl => !aEl.localeCompare(dEl, undefined, lcSensitivity)
      )
    })

    const ignoreHelper = await buildIgnoreHelper(this.config)

    return lines
      .filter(Boolean)
      .filter(line => this._filterInternal(line, deletedRenamed))
      .filter(line => ignoreHelper.keep(line))
  }

  _filterInternal(line, deletedRenamed) {
    return (
      !deletedRenamed.includes(line) &&
      line.split(sep).some(part => this.metadata.has(part))
    )
  }

  _extractComparisonName(line) {
    const type = getType(line, this.metadata)
    const el = parse(line.replace(GIT_DIFF_TYPE_REGEX, ''))
    let comparisonName = el.base
    if (pathType.includes(type)) {
      comparisonName = line
        .split(sep)
        .reduce(
          (acc, value) => (acc || this.metadata.has(value) ? acc + value : acc),
          ''
        )
    }
    return comparisonName
  }
}

module.exports = RepoGitDiff
