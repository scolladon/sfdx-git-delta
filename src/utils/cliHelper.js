'use strict'
const RepoSetup = require('./repoSetup')
const { sanitizePath } = require('./childProcessUtils')

const fs = require('fs')
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
    ;[this.config.output, this.config.source]
      .filter(dir => !dirExist(dir))
      .forEach(dir => errors.push(`${dir} folder does not exist`))

    if (!git.isGitSync(this.config.repo)) {
      errors.push(`${this.config.repo} is not a git repository`)
    }

    if (!this.repoSetup.isToEqualHead() && this.config.generateDelta) {
      errors.push(
        `--generate-delta (-d) parameter cannot be used when --to (-t) parameter is not equivalent to HEAD`
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
    this.config.ignore = sanitizePath(this.config.ignore)
    this.config.ignoreDestructive = sanitizePath(this.config.ignoreDestructive)
    this.config.from = this.repoSetup.computeFromRef()
  }

  static TO_DEFAULT_VALUE = 'HEAD'
  static OUTPUT_DEFAULT_VALUE = './output'
  static SOURCE_DEFAULT_VALUE = '.'
  static REPO_DEFAULT_VALUE = '.'
  static IGNORE_DEFAULT_VALUE = '.'
}
module.exports = CLIHelper
