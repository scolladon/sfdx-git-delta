'use strict'
import { join } from 'node:path/posix'

import GitAdapter from '../adapter/GitAdapter.js'
import { GIT_FOLDER } from '../constant/gitConstants.js'
import { getLatestSupportedVersion } from '../metadata/metadataManager.js'
import type { Config } from '../types/config.js'
import type { Work } from '../types/work.js'
import { ConfigError } from './errorUtils.js'
import { fileExists, pathExists, readFile, sanitizePath } from './fsUtils.js'
import { log } from './LoggingDecorator.js'
import { MessageService } from './MessageService.js'

const TO: keyof Config = 'to'
const FROM: keyof Config = 'from'

const SOURCE_API_VERSION_ATTRIBUTE = 'sourceApiVersion'
const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json'

export default class ConfigValidator {
  protected readonly config: Config
  protected readonly gitAdapter: GitAdapter
  protected readonly message: MessageService

  constructor(protected readonly work: Work) {
    this.config = work.config
    this.gitAdapter = GitAdapter.getInstance(work.config)
    this.message = new MessageService()
  }

  protected async _validateGitSha() {
    const errors: string[] = []

    await Promise.all(
      [FROM, TO].map(async (shaParameter: keyof Config) => {
        const shaValue: string = this.config[shaParameter] as string
        try {
          const ref: string = await this.gitAdapter.parseRev(shaValue)
          ;(this.config[shaParameter] as string) = ref
        } catch {
          errors.push(
            this.message.getMessage('error.ParameterIsNotGitSHA', [
              shaParameter,
              shaValue,
            ])
          )
        }
      })
    )

    return errors
  }

  @log
  public async validateConfig() {
    this._sanitizeConfig()
    await this._handleDefault()
    const errors: string[] = []

    const repoExists = await pathExists(join(this.config.repo, GIT_FOLDER))
    if (!repoExists) {
      errors.push(
        this.message.getMessage('error.PathIsNotGit', [this.config.repo])
      )
    }

    const gitErrors = await this._validateGitSha()
    errors.push(...gitErrors)

    if (errors.length > 0) {
      throw new ConfigError(errors.join(', '))
    }

    await this.gitAdapter.configureRepository()
  }

  protected async _handleDefault() {
    await this._getApiVersion()
    await this._apiVersionDefault()
  }

  protected async _getApiVersion() {
    if (this.config.apiVersion === undefined) {
      const sfdxProjectPath = join(this.config.repo, SFDX_PROJECT_FILE_NAME)
      const exists = await fileExists(sfdxProjectPath)
      if (exists) {
        const sfdxProjectRaw = await readFile(sfdxProjectPath)
        const sfdxProject = JSON.parse(sfdxProjectRaw)
        const projectApiVersion = sfdxProject[SOURCE_API_VERSION_ATTRIBUTE]
        if (projectApiVersion) {
          this.config.apiVersion = parseInt(projectApiVersion)
        }
      }
    }
  }

  protected async _apiVersionDefault() {
    if (this.config.apiVersion === undefined || isNaN(this.config.apiVersion)) {
      this.config.apiVersion = await getLatestSupportedVersion()
    }
  }

  protected _sanitizeConfig() {
    this.config.repo = sanitizePath(this.config.repo)!
    this.config.source = this.config.source.map(source => sanitizePath(source)!)
    this.config.output = sanitizePath(this.config.output)!
    this.config.ignore = sanitizePath(this.config.ignore)
    this.config.ignoreDestructive = sanitizePath(this.config.ignoreDestructive)
    this.config.include = sanitizePath(this.config.include)
    this.config.includeDestructive = sanitizePath(
      this.config.includeDestructive
    )
    this.config.additionalMetadataRegistryPath = sanitizePath(
      this.config.additionalMetadataRegistryPath
    )
  }
}
