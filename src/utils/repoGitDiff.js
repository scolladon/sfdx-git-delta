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

  async getIncludedFiles() {
    const gitLs = childProcess.spawn('git', [...allFilesParams], {
      cwd: this.config.repo,
      encoding: gc.UTF8_ENCODING,
    })

    const lines = []
    for await (const line of cpUtils.linify(gitLs.stdout)) {
      lines.push(cpUtils.treatPathSep(line))
    }

    return this._addIncludes(lines)
  }

  async getFilteredDiff() {
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

    return this._treatResult(lines)
  }

  _treatResult(lines) {
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

    return lines
      .filter(line => this._filterInternal(line, deletedRenamed))
      .filter(line => this._filterIgnore(line))
  }

  _filterInternal(line, deletedRenamed) {
    return (
      !!line &&
      !deletedRenamed.includes(line) &&
      line
        .split(path.sep)
        .some(part => Object.prototype.hasOwnProperty.call(this.metadata, part))
    )
  }

  _addIncludes(lines) {
    return [
      { include: this.config.include, prefix: 'A' },
      { include: this.config.includeDestructive, prefix: 'D' },
    ]
      .filter(obj => obj.include)
      .flatMap(async obj =>
        micromatch(
          lines,
          await fs.promises
            .readFile(obj.include)
            .toString()
            .split(os.EOL)
            .filter(Boolean)
        ).map(include => `${obj.prefix}      ${include}`)
      )
  }

  _filterIgnore(line) {
    const fileIgnorer = ignore()
    const fileDestIgnorer = ignore()
    ;[
      { ignore: this.config.ignore, helper: fileIgnorer },
      { ignore: this.config.ignoreDestructive, helper: fileDestIgnorer },
    ]
      .filter(ign => ign.ignore)
      .forEach(async ign => {
        try {
          const ignoreContent = await fs.promises
            .readFile(ign.ignore)
            .toString()
          ign.helper.add(ignoreContent)
        } catch (err) {
          // TODO handle the error here ?
        }
      })
    return this.config.ignoreDestructive
      ? line.startsWith(gc.DELETION)
        ? !fileDestIgnorer.ignores(line.replace(gc.GIT_DIFF_TYPE_REGEX, ''))
        : !fileIgnorer.ignores(line.replace(gc.GIT_DIFF_TYPE_REGEX, ''))
      : !fileIgnorer.ignores(line.replace(gc.GIT_DIFF_TYPE_REGEX, ''))
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
