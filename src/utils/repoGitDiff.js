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
    return new Promise((resolve, reject) => {
      const git = childProcess.spawn('git', [...allFilesParams], {
        cwd: this.config.repo,
        encoding: gc.UTF8_ENCODING,
      })

      const buffer = []
      git.stdout.on('data', data => buffer.push(data))
      git.on('close', () =>
        resolve(this._addIncludes(cpUtils.treatDataFromSpawn(buffer.join(''))))
      )
      git.on('error', reject)
    })
  }

  async getFilteredDiff() {
    const ignoreWhitespaceParams = this.config.ignoreWhitespace
      ? gc.IGNORE_WHITESPACE_PARAMS
      : []
    return new Promise((resolve, reject) => {
      const git = childProcess.spawn(
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

      const buffer = []
      git.stdout.on('data', data => buffer.push(data))
      git.on('close', () =>
        resolve(this._treatResult(cpUtils.treatDataFromSpawn(buffer.join(''))))
      )
      git.on('error', reject)
    })
  }

  _treatResult(repoDiffResult) {
    const lines = repoDiffResult.split(os.EOL)
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
    ].flatMap(obj => {
      return obj.include
        ? micromatch(
            lines.split(os.EOL),
            fs
              .readFileSync(obj.include)
              .toString()
              .split(os.EOL)
              .filter(Boolean)
          ).map(include => `${obj.prefix}      ${include}`)
        : []
    })
  }

  _filterIgnore(line) {
    const fileIgnorer = ignore()
    const fileDestIgnorer = ignore()
    ;[
      { ignore: this.config.ignore, helper: fileIgnorer },
      { ignore: this.config.ignoreDestructive, helper: fileDestIgnorer },
    ].forEach(
      ign =>
        ign.ignore &&
        fs.existsSync(ign.ignore) &&
        ign.helper.add(fs.readFileSync(ign.ignore).toString())
    )
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
