'use strict'
const RepoSetup = require('./repoSetup')
const { sanitizePath } = require('./childProcessUtils')

const fs = require('fs')
const path = require('path')
const git = require('git-state')

const dirExist = dir => fs.existsSync(dir) && fs.statSync(dir).isDirectory()

class CLIHelper {
  constructor(config) {
    this.config = config
    this.repoSetup = new RepoSetup(config)
  }

  validateConfig() {
    this._sanitizeConfig()
    const errors = []
    if (typeof this.config.to !== 'string') {
      errors.push(`to ${this.config.to} is not a sha`)
    }
    if (isNaN(this.config.apiVersion)) {
      errors.push(`api-version ${this.config.apiVersion} is not a number`)
    }
    if (!dirExist(this.config.output)) {
      errors.push(`${this.config.output} folder does not exist`)
    }
    if (!git.isGitSync(this.config.repo)) {
      errors.push(`${this.config.repo} is not a git repository`)
    }
    if (!dirExist(this.config.source)) {
      errors.push(`${this.config.source} folder does not exist`)
    }
    if (!this.repoSetup.isToEqualHead() && this.config.generateDelta) {
      errors.push(
        `--generate-delta (-d) parameter cannot be used when --to (-t) parameter is not equivalent to HEAD`
      )
    }

    if (
      this.config.generateDelta &&
      path.resolve(this.config.output) === path.resolve(this.config.repo)
    ) {
      errors.push(
        `--generate-delta (-d) parameter cannot be used when --output (-o) parameter is equal to --repo (-r). Side effect would be to override repo content`
      )
    }

    if (errors.length > 0) {
      throw new Error(errors)
    }

    this.repoSetup.repoConfiguration()
  }

  _sanitizeConfig() {
    this.config.apiVersion = parseInt(this.config.apiVersion)
    this.config.repo = sanitizePath(this.config.repo)
    this.config.source = sanitizePath(this.config.source)
    this.config.output = sanitizePath(this.config.output)
    this.config.ignore = this.config.ignore
      ? sanitizePath(this.config.ignore)
      : this.config.ignore
    this.config.ignoreDestructive = this.config.ignoreDestructive
      ? sanitizePath(this.config.ignoreDestructive)
      : this.config.ignoreDestructive
    this.config.from = this.repoSetup.computeFromRef()
  }
}

module.exports.TO_DEFAULT_VALUE = 'HEAD'
module.exports.OUTPUT_DEFAULT_VALUE = '.'
module.exports.SOURCE_DEFAULT_VALUE = '.'
module.exports.REPO_DEFAULT_VALUE = '.'
module.exports.IGNORE_DEFAULT_VALUE = '.'
module.exports = CLIHelper
