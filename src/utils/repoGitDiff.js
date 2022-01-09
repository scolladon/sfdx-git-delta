'use strict'
const cpUtils = require('./childProcessUtils')
const CustomObject = require('../service/customObjectHandler')
const InTranslation = require('../service/inTranslationHandler')
const SubCustomObject = require('../service/subCustomObjectHandler')
const typeUtils = require('../utils/typeUtils')
const gc = require('./gitConstants')
const childProcess = require('child_process')
const fs = require('fs')
const ignore = require('ignore')
const micromatch = require('micromatch')

const os = require('os')
const path = require('path')

const fullDiffParams = ['--no-pager', 'diff', '--name-status', '--no-renames']
const allFilesParams = ['ls-files']
const lcSensitivity = {
  sensitivity: 'accent',
}

const pathType = [
  CustomObject.OBJECT_TYPE,
  InTranslation.OBJECT_TRANSLATION_TYPE,
  ...SubCustomObject.SUB_OBJECT_TYPES,
]
class RepoGitDiff {
  constructor(config, metadata) {
    this.config = config
    this.metadata = metadata
    this.spawnConfig = {
      cwd: this.config.repo,
      encoding: gc.UTF8_ENCODING,
      maxBuffer: 1024 * 10240,
    }
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

    const gitLs = childProcess.spawn('git', [...allFilesParams], {
      cwd: this.config.repo,
      encoding: gc.UTF8_ENCODING,
    })
    const lines = []
    for await (const line of cpUtils.linify(gitLs.stdout)) {
      lines.push(cpUtils.treatPathSep(line))
    }
    return RepoGitDiff._addIncludes(lines, includeSetup)
  }

  async _getFilteredDiff() {
    const ignoreWhitespaceParams = this.config.ignoreWhitespace
      ? gc.IGNORE_WHITESPACE_PARAMS
      : []
    const gitDiff = childProcess.spawn(
      'git',
      [
        ...fullDiffParams,
        ...ignoreWhitespaceParams,
        this.config.from,
        this.config.to,
        this.config.source,
      ],
      { cwd: this.config.repo, encoding: gc.UTF8_ENCODING }
    )

    const lines = []
    for await (const line of cpUtils.linify(gitDiff.stdout)) {
      lines.push(cpUtils.treatPathSep(line))
    }

    const treatedLines = await this._treatResult(lines)
    return treatedLines
  }

  async _treatResult(lines) {
    const linesPerDiffType = lines.reduce(
      (acc, line) => (acc[line.charAt(0)]?.push(line), acc),
      { [gc.ADDITION]: [], [gc.DELETION]: [] }
    )
    const AfileNames = linesPerDiffType[gc.ADDITION].map(line =>
      this._extractComparisonName(line)
    )
    const deletedRenamed = linesPerDiffType[gc.DELETION].filter(line => {
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
      line
        .split(path.sep)
        .some(part => Object.prototype.hasOwnProperty.call(this.metadata, part))
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
        { include: config.include, prefix: 'A' },
        { include: config.includeDestructive, prefix: 'D' },
      ]
        .filter(obj => obj.include)
        .map(async obj => {
          const content = await fs.promises.readFile(obj.include)
          return {
            ...obj,
            content: content.toString().split(os.EOL).filter(Boolean),
          }
        })
    )
    return setup
  }

  static async _setupIgnore(config) {
    const setup = await Promise.all(
      [
        { ignore: config.ignore, helper: ignore() },
        { ignore: config.ignoreDestructive, helper: ignore() },
      ]
        .filter(obj => obj.ignore)
        .map(async obj => {
          if (obj.ignore) {
            const content = await fs.promises.readFile(obj.ignore)
            obj.helper.add(content.toString())
          }
          return obj
        })
    )
    return setup
  }

  _filterIgnore(line, ignoreSetup) {
    const filePath = line.replace(gc.GIT_DIFF_TYPE_REGEX, '')
    return this.config.ignoreDestructive
      ? line.startsWith(gc.DELETION)
        ? !ignoreSetup[1]?.helper?.ignores(filePath)
        : !ignoreSetup[0]?.helper?.ignores(filePath)
      : !ignoreSetup[0]?.helper?.ignores(filePath)
  }

  _extractComparisonName(line) {
    const type = typeUtils.getType(line, this.metadata)
    const el = path.parse(line.replace(gc.GIT_DIFF_TYPE_REGEX, ''))
    let comparisonName = el.base
    if (pathType.includes(type)) {
      comparisonName = line
        .split(path.sep)
        .reduce(
          (acc, value) =>
            acc || Object.prototype.hasOwnProperty.call(this.metadata, value)
              ? acc + value
              : acc,
          ''
        )
    }
    return comparisonName
  }
}

module.exports = RepoGitDiff
