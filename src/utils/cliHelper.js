'use strict'
const asyncFilter = require('./asyncFilter')
const RepoSetup = require('./repoSetup')
const { sanitizePath } = require('./childProcessUtils')
const { GIT_FOLDER } = require('./gitConstants')

const { stat } = require('fs').promises
const { join } = require('path')

const fsExists = async (dir, fn) => {
  try {
    const st = await stat(dir)
    return st[fn]()
  } catch {
    return false
  }
}

const dirExists = async dir => await fsExists(dir, 'isDirectory')

const fileExists = async file => await fsExists(file, 'isFile')

const isGit = async dir => {
  return await dirExists(join(dir, GIT_FOLDER))
}

class CLIHelper {
  constructor(config) {
    this.config = config
    this.repoSetup = new RepoSetup(config)
  }

  async validateConfig() {
    await this._sanitizeConfig()
    const errors = []
    if (typeof this.config.to !== 'string') {
      errors.push(`to ${this.config.to} is not a sha`)
    }
    if (isNaN(this.config.apiVersion)) {
      errors.push(`api-version ${this.config.apiVersion} is not a number`)
    }

    const isGitPromise = isGit(this.config.repo)
    const isToEqualHeadPromise = this.repoSetup.isToEqualHead()
    const directoriesPromise = this._filterDirectories()
    const filesPromise = this._filterFiles()

    const directories = await directoriesPromise
    directories.forEach(dir => errors.push(`${dir} folder does not exist`))

    const files = await filesPromise
    files.forEach(file => errors.push(`${file} file does not exist`))

    const isGitRepo = await isGitPromise
    if (!isGitRepo) {
      errors.push(`${this.config.repo} is not a git repository`)
    }

    const isToEqualHead = await isToEqualHeadPromise
    if (!isToEqualHead && this.config.generateDelta) {
      errors.push(
        `--generate-delta (-d) parameter cannot be used when --to (-t) parameter is not equivalent to HEAD`
      )
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }

    await this.repoSetup.repoConfiguration()
  }

  _filterDirectories() {
    return asyncFilter(
      [this.config.output, this.config.source].filter(Boolean),
      async dir => {
        const exist = await dirExists(dir)
        return !exist
      }
    )
  }

  _filterFiles() {
    return asyncFilter(
      [
        this.config.ignore,
        this.config.ignoreDestructive,
        this.config.include,
        this.config.includeDestructive,
      ].filter(Boolean),
      async file => {
        const exist = await fileExists(file)
        return !exist
      }
    )
  }

  async _sanitizeConfig() {
    this.config.apiVersion = parseInt(this.config.apiVersion)
    this.config.repo = sanitizePath(this.config.repo)
    this.config.source = sanitizePath(this.config.source)
    this.config.output = sanitizePath(this.config.output)
    this.config.ignore = sanitizePath(this.config.ignore)
    this.config.ignoreDestructive = sanitizePath(this.config.ignoreDestructive)
    this.config.from = await this.repoSetup.computeFromRef()
    this.config.include = sanitizePath(this.config.include)
    this.config.includeDestructive = sanitizePath(
      this.config.includeDestructive
    )
  }

  static TO_DEFAULT_VALUE = 'HEAD'
  static OUTPUT_DEFAULT_VALUE = './output'
  static SOURCE_DEFAULT_VALUE = '.'
  static REPO_DEFAULT_VALUE = '.'
  static IGNORE_DEFAULT_VALUE = '.'
}
module.exports = CLIHelper
