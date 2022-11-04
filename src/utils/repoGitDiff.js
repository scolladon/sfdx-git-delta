'use strict'
const cpUtils = require('./childProcessUtils')
const { getType } = require('./typeUtils')
const IgnoreHelper = require('./ignoreHelper')
const {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  UTF8_ENCODING,
} = require('./gitConstants')
const {
  SUB_OBJECT_TYPES,
  OBJECT_TYPE,
  OBJECT_TRANSLATION_TYPE,
} = require('./metadataConstants')
const { spawn } = require('child_process')
const { readFile } = require('fs').promises
const ignore = require('ignore')
const micromatch = require('micromatch')
const os = require('os')
const path = require('path')

const DIFF_FILTER = '--diff-filter'

const fullDiffParams = ['--no-pager', 'diff', '--numstat', '--no-renames']
const filterDeleted = [`${DIFF_FILTER}=${DELETION}`]
const filterAdded = [`${DIFF_FILTER}=${ADDITION}`]
const filterModification = [`${DIFF_FILTER}=${MODIFICATION}`]
const TAB = '\t'
const NUM_STAT_REGEX = /^((-|\d+)\t){2}/
const allFilesParams = ['ls-files']
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
    const lines = await Promise.all([
      this._getIncludedFiles(),
      this._getFilteredDiff(),
    ])

    return Array.from(new Set([...lines.flat().filter(Boolean)]))
  }

  async _getIncludedFiles() {
    const includeSetup = await RepoGitDiff._setupIncludes(this.config)
    if (includeSetup.length === 0) {
      return
    }

    const gitLs = spawn('git', [...allFilesParams], this.spawnConfig)
    const lines = []
    for await (const line of cpUtils.linify(gitLs.stdout)) {
      lines.push(cpUtils.treatPathSep(line))
    }
    return RepoGitDiff._addIncludes(lines, includeSetup)
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
      'git',
      [
        ...fullDiffParams,
        ...filter,
        ...this.ignoreWhitespaceParams,
        this.config.from,
        this.config.to,
        this.config.source,
      ],
      this.spawnConfig
    )
    for await (const line of cpUtils.linify(gitDiff.stdout)) {
      lines.push(
        cpUtils
          .treatPathSep(line)
          .replace(NUM_STAT_REGEX, `${changeType}${TAB}`)
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

    const ignoreSetup = await RepoGitDiff._setupIgnore(this.config)

    return lines
      .filter(Boolean)
      .filter(line => this._filterInternal(line, deletedRenamed))
      .filter(line => this._filterIgnore(line, ignoreSetup))
  }

  _filterInternal(line, deletedRenamed) {
    return (
      !deletedRenamed.includes(line) &&
      line.split(path.sep).some(part => this.metadata.has(part))
    )
  }

  static _addIncludes(lines, setup) {
    return setup.flatMap(obj =>
      micromatch(lines, obj.content).map(
        include => `${obj.prefix}      ${include}`
      )
    )
  }

  static async _setupIncludes(config) {
    const setup = await Promise.all(
      [
        { include: config.include, prefix: ADDITION },
        { include: config.includeDestructive, prefix: DELETION },
      ]
        .filter(obj => obj.include)
        .map(async obj => {
          const content = await readFile(obj.include)
          return {
            ...obj,
            content: content.toString().split(os.EOL).filter(Boolean),
          }
        })
    )
    return setup
  }

  static async _setupIgnore(config) {
    const ignoreHelper = new IgnoreHelper()
    const setup = await Promise.all(
      [
        { ignore: config.ignore, helper: ignore() },
        { ignore: config.ignoreDestructive, helper: ignore() },
      ].map(async obj => {
        if (obj.ignore) {
          obj.helper = await ignoreHelper.forPath(obj.ignore)
        }
        return obj
      })
    )
    return setup
  }

  _filterIgnore(line, ignoreSetup) {
    let helper
    if (this.config.ignoreDestructive && line.startsWith(DELETION)) {
      helper = ignoreSetup[1].helper
    } else if (
      this.config.ignore &&
      [ADDITION, MODIFICATION].some(status => line.startsWith(status))
    ) {
      helper = ignoreSetup[0].helper
    }

    let keepLine = true
    if (helper) {
      const filePath = line.replace(GIT_DIFF_TYPE_REGEX, '')
      keepLine = !helper?.ignores(filePath)
    }

    return keepLine
  }

  _extractComparisonName(line) {
    const type = getType(line, this.metadata)
    const el = path.parse(line.replace(GIT_DIFF_TYPE_REGEX, ''))
    let comparisonName = el.base
    if (pathType.includes(type)) {
      comparisonName = line
        .split(path.sep)
        .reduce(
          (acc, value) => (acc || this.metadata.has(value) ? acc + value : acc),
          ''
        )
    }
    return comparisonName
  }
}

module.exports = RepoGitDiff
