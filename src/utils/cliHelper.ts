'use strict'
import asyncFilter from './asyncFilter'
import messages from '../locales/en'
import RepoSetup from './repoSetup'
import { sanitizePath } from './childProcessUtils'
import { POINTER_REF_TYPES } from './gitConstants'
import {
  getLatestSupportedVersion,
  isVersionSupported,
} from '../metadata/metadataManager'
import { format } from 'util'
import { readFile, dirExists, fileExists, isGit } from './fsHelper'
import { join } from 'path'
import { Work } from '../types/work'
import { Config } from '../types/config'

const isBlank = (str: string) => !str || /^\s*$/.test(str)

const GIT_SHA_PARAMETERS: (keyof Config)[] = ['to', 'from']
const SOURCE_API_VERSION_ATTRIBUTE = 'sourceApiVersion'
const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json'

export default class CLIHelper {
  protected readonly config: Config
  protected readonly repoSetup: RepoSetup

  constructor(protected readonly work: Work) {
    this.config = work.config
    this.repoSetup = new RepoSetup(work.config)
  }

  protected async _validateGitSha() {
    const errors: string[] = []
    await Promise.all(
      GIT_SHA_PARAMETERS.filter((shaParameter: keyof Config) => {
        const shaValue: string = this.config[shaParameter] as string
        if (isBlank(shaValue)) {
          errors.push(
            format(messages.errorGitSHAisBlank, shaParameter, shaValue)
          )
          return false
        }
        return true
      }).map(async (shaParameter: keyof Config) => {
        const shaValue: string = this.config[shaParameter] as string
        const refType = await this.repoSetup.getCommitRefType(shaValue)
        if (!POINTER_REF_TYPES.includes(refType?.replace(/\s/g, ''))) {
          errors.push(
            format(messages.errorParameterIsNotGitSHA, shaParameter, shaValue)
          )
        }
      })
    )

    return errors
  }

  public async validateConfig() {
    this._sanitizeConfig()
    await this._handleDefault()
    const errors: string[] = []

    const isGitPromise = isGit(this.config.repo)
    const directoriesPromise = this._filterDirectories()
    const filesPromise = this._filterFiles()

    const directories = await directoriesPromise
    directories.forEach((dir: string) =>
      errors.push(format(messages.errorPathIsNotDir, dir))
    )

    const files = await filesPromise
    files.forEach((file: string) =>
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

  protected _filterDirectories() {
    return asyncFilter(
      [this.config.output, join(this.config.repo, this.config.source)].filter(
        Boolean
      ),
      async (dir: string) => {
        const exist = await dirExists(dir)
        return !exist
      }
    )
  }

  protected _filterFiles() {
    return asyncFilter(
      [
        this.config.ignore,
        this.config.ignoreDestructive,
        this.config.include,
        this.config.includeDestructive,
      ].filter(Boolean),
      async (file: string) => {
        const exist = await fileExists(file)
        return !exist
      }
    )
  }

  protected async _handleDefault() {
    await this._getApiVersion()
    await this._apiVersionDefault()
  }

  protected async _getApiVersion() {
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
          parseInt(sfdxProject[SOURCE_API_VERSION_ATTRIBUTE]) || -1
      }
    }
  }

  protected async _apiVersionDefault() {
    const isInputVersionSupported = await isVersionSupported(
      this.config.apiVersion
    )

    if (!isInputVersionSupported) {
      const latestAPIVersionSupported = await getLatestSupportedVersion()
      if (
        this.config.apiVersion !== undefined &&
        this.config.apiVersion !== null
      ) {
        this.work.warnings.push(
          new Error(
            format(
              messages.warningApiVersionNotSupported,
              latestAPIVersionSupported
            )
          )
        )
      }
      this.config.apiVersion = latestAPIVersionSupported
    }
  }

  protected _sanitizeConfig() {
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
}

export const TO_DEFAULT_VALUE = 'HEAD'
export const OUTPUT_DEFAULT_VALUE = './output'
export const SOURCE_DEFAULT_VALUE = './'
export const REPO_DEFAULT_VALUE = './'
