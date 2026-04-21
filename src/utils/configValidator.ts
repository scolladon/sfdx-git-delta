'use strict'
import { stat } from 'node:fs/promises'
import { join } from 'node:path/posix'

import { SfProject } from '@salesforce/core'

import GitAdapter from '../adapter/GitAdapter.js'
import { GIT_FOLDER } from '../constant/gitConstants.js'
import { getLatestSupportedVersion } from '../metadata/metadataManager.js'
import type { Config } from '../types/config.js'
import type { Work } from '../types/work.js'
import { pushAll } from './arrayUtils.js'
import { ConfigError, getErrorMessage } from './errorUtils.js'
import { pathExists, sanitizePath } from './fsUtils.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import { MessageService } from './MessageService.js'

type ShaKey = 'from' | 'to'
const SHA_KEYS: readonly ShaKey[] = ['from', 'to']

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
      SHA_KEYS.map(async shaParameter => {
        const shaValue = this.config[shaParameter]
        try {
          this.config[shaParameter] = await this.gitAdapter.parseRev(shaValue)
        } catch (error) {
          Logger.debug(
            lazy`_validateGitSha: '${shaParameter}' = '${shaValue}' is not a valid git SHA: ${() => getErrorMessage(error)}`
          )
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

    const [, repoExists, gitErrors, changesManifestErrors] = await Promise.all([
      this._handleDefault(),
      pathExists(join(this.config.repo, GIT_FOLDER)),
      this._validateGitSha(),
      this._validateChangesManifest(),
    ])

    const errors: string[] = []
    if (!repoExists) {
      errors.push(
        this.message.getMessage('error.PathIsNotGit', [this.config.repo])
      )
    }
    pushAll(errors, gitErrors)
    pushAll(errors, changesManifestErrors)

    if (errors.length > 0) {
      throw new ConfigError(errors.join(', '))
    }

    await this.gitAdapter.configureRepository()
  }

  // oclif cannot natively validate --changes-manifest (it uses a string flag
  // to allow the bare form). Replicate meaningful checks: if the path already
  // exists it must be a regular file; otherwise ENOENT is fine because
  // fs-extra's outputFile creates the parent directory at write time.
  protected async _validateChangesManifest(): Promise<string[]> {
    const target = this.config.changesManifest
    if (!target) return []
    try {
      const stats = await stat(target)
      if (!stats.isFile()) {
        return [
          this.message.getMessage('error.ChangesManifestNotAFile', [target]),
        ]
      }
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        return [
          this.message.getMessage('error.ChangesManifestStatFailed', [
            target,
            getErrorMessage(error),
          ]),
        ]
      }
    }
    return []
  }

  protected async _handleDefault() {
    await this._getApiVersion()
    await this._apiVersionDefault()
  }

  protected async _getApiVersion() {
    if (this.config.apiVersion !== undefined) return

    try {
      const sfProject = await SfProject.resolve(this.config.repo)
      const projectApiVersion = sfProject
        .getSfProjectJson()
        .getContents().sourceApiVersion
      if (projectApiVersion) {
        this.config.apiVersion = parseInt(projectApiVersion, 10)
      }
    } catch (ex) {
      Logger.debug(
        lazy`_getApiVersion: no sfdx-project.json found at '${this.config.repo}': ${ex}`
      )
    }
  }

  protected async _apiVersionDefault() {
    const latestVersion = await getLatestSupportedVersion()

    if (
      this.config.apiVersion !== undefined &&
      !isNaN(this.config.apiVersion) &&
      this.config.apiVersion > latestVersion
    ) {
      this.work.warnings.push(
        new Error(
          this.message.getMessage('warning.ApiVersionOverridden', [
            String(this.config.apiVersion),
            String(latestVersion),
          ])
        )
      )
      this.config.apiVersion = latestVersion
    }

    if (this.config.apiVersion === undefined || isNaN(this.config.apiVersion)) {
      this.config.apiVersion = latestVersion
      this.work.warnings.push(
        new Error(
          this.message.getMessage('warning.ApiVersionDefaulted', [
            String(latestVersion),
          ])
        )
      )
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
    this.config.changesManifest = sanitizePath(this.config.changesManifest)
  }
}
