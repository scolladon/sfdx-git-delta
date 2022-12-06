'use strict'
const asyncFilter = require('./asyncFilter')
const messages = require('../locales/en')
const RepoSetup = require('./repoSetup')
const { sanitizePath } = require('./childProcessUtils')
const { GIT_FOLDER, POINTER_REF_TYPES } = require('./gitConstants')
const {
  getLatestSupportedVersion,
  isVersionSupported,
} = require('../metadata/metadataManager')
const { format } = require('util')
const { stat } = require('fs').promises
const { readFile } = require('./fsHelper')
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
  const isGitDir = await dirExists(join(dir, GIT_FOLDER))
  const isGitFile = await fileExists(join(dir, GIT_FOLDER))

  return isGitDir || isGitFile
}

const isBlank = str => !str || /^\s*$/.test(str)

const GIT_SHA_PARAMETERS = ['to', 'from']
const SOURCE_API_VERSION_ATTRIBUT = 'sourceApiVersion'
const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json'

class CLIHelper {
  constructor(work) {
    this.work = work
    this.config = work.config
    this.repoSetup = new RepoSetup(work.config)
  }

  async _validateGitSha() {
    const errors = []
    await Promise.all(
      GIT_SHA_PARAMETERS.filter(
        field =>
          !isBlank(this.config[field]) ||
          !errors.push(
            format(messages.errorGitSHAisBlank, field, this.config[field])
          )
      ).map(async field => {
        const refType = await this.repoSetup.getCommitRefType(
          this.config[field]
        )
        if (!POINTER_REF_TYPES.includes(refType?.replace(/\s/g, ''))) {
          errors.push(
            format(
              messages.errorParameterIsNotGitSHA,
              field,
              this.config[field]
            )
          )
        }
      })
    )

    return errors
  }

  async validateConfig() {
    this._sanitizeConfig()
    await this._handleDefault()
    const errors = []

    const isGitPromise = isGit(this.config.repo)
    const directoriesPromise = this._filterDirectories()
    const filesPromise = this._filterFiles()

    const directories = await directoriesPromise
    directories.forEach(dir =>
      errors.push(format(messages.errorPathIsNotDir, dir))
    )

    const files = await filesPromise
    files.forEach(file =>
      errors.push(format(messages.errorPathIsNotFile, file))
    )

    const isGitRepo = await isGitPromise
    if (!isGitRepo) {
      errors.push(format(messages.errorPathIsNotGit, this.config.repo))
    }

    const gitErrors = await this._validateGitSha()
    errors.push(...gitErrors)

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

  async _handleDefault() {
    await this._getApiVersion()
    await this._apiVersionDefault()
  }

  async _getApiVersion() {
    const isInputVersionSupported = await isVersionSupported(
      this.config.apiVersion
    )
    if (!isInputVersionSupported) {
      const sfdxProjectPath = join(this.config.repo, SFDX_PROJECT_FILE_NAME)
      const exists = await fileExists(sfdxProjectPath)
      if (exists) {
        const sfdxProjectRaw = await readFile(sfdxProjectPath)
        const sfdxProject = JSON.parse(sfdxProjectRaw)
        this.config.apiVersion =
          parseInt(sfdxProject[SOURCE_API_VERSION_ATTRIBUT]) || 'default'
      }
    }
  }

  async _apiVersionDefault() {
    const isInputVersionSupported = await isVersionSupported(
      this.config.apiVersion
    )

    if (!isInputVersionSupported) {
      const latestAPIVersionSupported = await getLatestSupportedVersion()
      if (
        this.config.apiVersion !== undefined &&
        this.config.apiVersion !== null
      ) {
        this.work.warnings.push({
          message: format(
            messages.warningApiVersionNotSupported,
            latestAPIVersionSupported
          ),
        })
      }
      this.config.apiVersion = latestAPIVersionSupported
    }
  }

  _sanitizeConfig() {
    this.config.apiVersion = parseInt(this.config.apiVersion)
    this.config.repo = sanitizePath(this.config.repo)
    this.config.source = sanitizePath(this.config.source)
    this.config.output = sanitizePath(this.config.output)
    this.config.ignore = sanitizePath(this.config.ignore)
    this.config.ignoreDestructive = sanitizePath(this.config.ignoreDestructive)
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
