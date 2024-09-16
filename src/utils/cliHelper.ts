'use strict'
import { join } from 'node:path'
import { format } from 'util'

import GitAdapter from '../adapter/GitAdapter.js'
import messages from '../locales/en.js'
import {
  getLatestSupportedVersion,
  isVersionSupported,
} from '../metadata/metadataManager.js'
import type { Config } from '../types/config.js'
import type { Work } from '../types/work.js'

import { fileExists, readFile, sanitizePath } from './fsUtils.js'

const isBlank = (str: string) => !str || /^\s*$/.test(str)

const GIT_SHA_PARAMETERS: (keyof Config)[] = ['to', 'from']
const SOURCE_API_VERSION_ATTRIBUTE = 'sourceApiVersion'
const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json'

export default class CLIHelper {
  protected readonly config: Config
  protected readonly gitAdapter: GitAdapter

  constructor(protected readonly work: Work) {
    this.config = work.config
    this.gitAdapter = GitAdapter.getInstance(work.config)
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
        try {
          const ref: string = await this.gitAdapter.parseRev(shaValue)
          ;(this.config[shaParameter] as string) = ref
        } catch {
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

    try {
      await this.gitAdapter.setGitDir()
    } catch {
      errors.push(format(messages.errorPathIsNotGit, this.config.repo))
    }

    const gitErrors = await this._validateGitSha()
    errors.push(...gitErrors)

    if (errors.length > 0) {
      throw new Error(errors.join(', '))
    }

    await this.gitAdapter.configureRepository()
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
    this.config.repo = sanitizePath(this.config.repo)!
    this.config.source = sanitizePath(this.config.source)!
    this.config.output = sanitizePath(this.config.output)!
    this.config.ignore = sanitizePath(this.config.ignore)
    this.config.ignoreDestructive = sanitizePath(this.config.ignoreDestructive)
    this.config.include = sanitizePath(this.config.include)
    this.config.includeDestructive = sanitizePath(
      this.config.includeDestructive
    )
  }
}
