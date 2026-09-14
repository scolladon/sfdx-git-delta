'use strict'
import { stat } from 'node:fs/promises'
import { join } from 'node:path/posix'

import { SfProject } from '@salesforce/core'

import GitAdapter from '../adapter/GitAdapter.js'
import { GIT_FOLDER } from '../constant/gitConstants.js'
import { getLatestSupportedVersion } from '../metadata/metadataManager.js'
import type { Config } from '../types/config.js'
import {
  ConfigError,
  getErrorMessage,
  NotACommitError,
  RepositoryRefusalError,
} from './errorUtils.js'
import { pathExists, sanitizePath } from './fsUtils.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import { MessageService } from './MessageService.js'
import {
  redactProxyCredentials,
  sanitizeForMessage,
} from './messageSanitizer.js'
import type {
  SourceDirRejection,
  SourceDirRejectionReason,
} from './pathspec.js'

type ShaKey = 'from' | 'to'
const SHA_KEYS: readonly ShaKey[] = ['from', 'to']

const SOURCE_DIR_REJECTION_MESSAGE_KEYS: Record<
  SourceDirRejectionReason,
  string
> = {
  empty: 'error.SourceDirIsEmpty',
  magic: 'error.SourceDirUsesPathspecMagic',
  wildcard: 'error.SourceDirContainsWildcard',
  absolute: 'error.SourceDirIsAbsolute',
  escapes: 'error.SourceDirEscapesRepository',
}

const isPositiveVersion = (version: number): boolean => version > 0

type ApiVersionOutcome =
  | { readonly warnings: readonly Error[] }
  | { readonly refusal: string }

// Two values arrive unparsed: a JavaScript library caller's apiVersion, which
// the number type does not bind (e.g. '' or '67.0'), and sfdx-project.json's
// sourceApiVersion string. Parse the way the --api-version flag path does, so
// a value that does not parse to a positive version means "not provided"
// rather than rendering <version>.0</version>.
const toApiVersion = (value: unknown): number | undefined => {
  const parsed = parseInt(String(value), 10)
  return isPositiveVersion(parsed) ? parsed : undefined
}

export default class ConfigValidator {
  protected readonly gitAdapter: GitAdapter
  protected readonly message: MessageService

  constructor(
    protected readonly config: Config,
    private readonly sourceRejections: readonly SourceDirRejection[] = []
  ) {
    this.gitAdapter = GitAdapter.getInstance(config)
    this.message = new MessageService()
  }

  protected async _validateGitSha() {
    const errors: string[] = []

    await Promise.all(
      SHA_KEYS.map(async shaParameter => {
        const shaValue = this.config[shaParameter]
        try {
          this.config[shaParameter] =
            await this.gitAdapter.resolveCommit(shaValue)
        } catch (error) {
          Logger.debug(
            // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: catch log content is observability only
            lazy`_validateGitSha: '${shaParameter}' = '${shaValue}' does not resolve to a commit: ${() => getErrorMessage(error)}`
          )
          errors.push(this._shaFailureMessage(error, shaParameter, shaValue))
        }
      })
    )

    return errors
  }

  // A refusal is about the repository, not about either ref: reporting it
  // verbatim replaces two bogus "check the fetch depth" lines with the one
  // thing the user can act on. A non-commit is about the ref's KIND, not
  // its existence: the fetch-depth hint would send the user to deepen a
  // clone that is already complete, so it gets its own sentence. Both name
  // shaValue — what the user typed — never the oid resolveCommit produced.
  protected _shaFailureMessage(
    error: unknown,
    shaParameter: ShaKey,
    shaValue: string
  ): string {
    if (error instanceof RepositoryRefusalError) return error.message
    if (error instanceof NotACommitError) {
      return this.message.getMessage('error.ParameterIsNotCommit', [
        shaParameter,
        sanitizeForMessage(shaValue),
        error.objectType,
      ])
    }
    return this.message.getMessage('error.ParameterIsNotGitSHA', [
      shaParameter,
      sanitizeForMessage(shaValue),
    ])
  }

  protected _validateSource(): string[] {
    return this.sourceRejections.map(rejection =>
      this.message.getMessage(
        SOURCE_DIR_REJECTION_MESSAGE_KEYS[rejection.reason],
        [sanitizeForMessage(rejection.value)]
      )
    )
  }

  @log
  public async validateConfig(): Promise<readonly Error[]> {
    const requestedFrom = this.config.from
    const requestedTo = this.config.to
    this._sanitizeConfig()
    this._assertSourceDirs()
    const warnings = await this._validateInputsAndApiVersion()

    // Runs after the SHA validation above so a typo in either ref surfaces
    // as the precise ParameterIsNotGitSHA message instead of the vaguer
    // MergeBaseNotFound.
    await this._resolveMergeBase(requestedFrom, requestedTo)

    return warnings
  }

  // Short-circuits before any git object is read: _validateGitSha below
  // calls resolveCommit, which opens the repository. A bad --source-dir is
  // the actionable error and the one that today produces a silent empty
  // manifest, so it is reported alone even if the SHAs are also invalid.
  private _assertSourceDirs(): void {
    const sourceErrors = this._validateSource()
    if (sourceErrors.length > 0) {
      throw new ConfigError(sourceErrors.join(', '))
    }
  }

  private async _validateInputsAndApiVersion(): Promise<readonly Error[]> {
    const [
      apiVersionOutcome,
      repositoryErrors,
      gitErrors,
      changesManifestErrors,
    ] = await Promise.all([
      this._settleApiVersion(),
      this._validateRepository(),
      this._validateGitSha(),
      this._validateChangesManifest(),
    ])

    const errors = [...repositoryErrors, ...gitErrors, ...changesManifestErrors]
    // The refusal is about the environment, the input errors about what the
    // user typed: report both in one run, the typing first.
    if ('refusal' in apiVersionOutcome) {
      throw this._configError([...errors, apiVersionOutcome.refusal])
    }
    if (errors.length > 0) {
      throw this._configError(errors)
    }

    return apiVersionOutcome.warnings
  }

  // Only a ConfigError is a refusal to report alongside the input errors; any
  // other rejection is a defect and propagates untouched.
  private async _settleApiVersion(): Promise<ApiVersionOutcome> {
    try {
      return { warnings: await this._handleDefault() }
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error
      return { refusal: error.message }
    }
  }

  // Two SHA keys against one repository produce the same refusal twice, and a
  // missing .git makes the config check and the engine say the same sentence.
  // Identical strings carry no extra information.
  private _configError(errors: readonly string[]): ConfigError {
    return new ConfigError([...new Set(errors)].join(', '))
  }

  // --merge-base resolves --from to the merge base of --from and --to (git
  // three-dot semantics) in place. requestedFrom/requestedTo are the
  // user-typed refs, captured before _validateGitSha overwrites
  // this.config.from/to with resolved SHAs — the error the user sees must
  // name what they typed, not a 40-character hash.
  protected async _resolveMergeBase(
    requestedFrom: string,
    requestedTo: string
  ): Promise<void> {
    if (!this.config.mergeBase) return

    const base = await this.gitAdapter.getMergeBase(
      this.config.from,
      this.config.to
    )
    if (!base) {
      throw new ConfigError(
        this.message.getMessage('error.MergeBaseNotFound', [
          sanitizeForMessage(requestedFrom),
          sanitizeForMessage(requestedTo),
        ])
      )
    }
    this.config.from = base
  }

  // Rendered from the adapter's own absolute repository key — not
  // this.config.repo, which is only sanitizePath-normalized, never resolved to
  // absolute — so this collapses with the identical RepositoryRefusalError
  // message a same-repository resolveCommit failure produces, instead of
  // reporting the missing repository twice in two different forms.
  protected async _validateRepository(): Promise<string[]> {
    if (await pathExists(join(this.config.repo, GIT_FOLDER))) return []
    return [
      this.message.getMessage('error.PathIsNotGit', [
        sanitizeForMessage(this.gitAdapter.repositoryKey),
      ]),
    ]
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
      // fs/promises stat always rejects with ErrnoException; narrow through
      // an `instanceof Error` guard to keep `unknown` discipline, then read
      // the POSIX code to distinguish "doesn't exist yet" from real failures.
      const code =
        error instanceof Error
          ? (error as NodeJS.ErrnoException).code
          : undefined
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

  protected async _handleDefault(): Promise<readonly Error[]> {
    await this._getApiVersion()
    // A version the user pinned is emitted as pinned: capping it would need the
    // network, and a manifest that changes with network reachability is one the
    // user cannot reproduce.
    if (this._isPinned()) return []
    return await this._apiVersionDefault()
  }

  protected async _getApiVersion() {
    if (this._isPinned()) return

    try {
      const sfProject = await SfProject.resolve(this.config.repo)
      this.config.apiVersion = toApiVersion(
        sfProject.getSfProjectJson().getContents().sourceApiVersion
      )
    } catch (ex) {
      Logger.debug(
        // Stryker disable next-line StringLiteral -- equivalent: lazy log content is observability only
        lazy`_getApiVersion: no sfdx-project.json found at '${this.config.repo}': ${ex}`
      )
    }
  }

  protected async _apiVersionDefault(): Promise<readonly Error[]> {
    const latestVersion = await this._resolveLatestSupportedVersion()
    this.config.apiVersion = latestVersion
    return [
      new Error(
        this.message.getMessage('warning.ApiVersionDefaulted', [
          String(latestVersion),
        ])
      ),
    ]
  }

  // Only an unpinned run looks the version up, so there is nothing to fall back
  // to: a lookup that fails, or that answers with something that is not a
  // positive version, refuses the run. This tool cannot vouch for a <version> it
  // did not resolve, and a wrong one is authoritative at deploy time.
  protected async _resolveLatestSupportedVersion(): Promise<number> {
    const latestVersion = await this._lookUpLatestVersion()
    if (isPositiveVersion(latestVersion)) return latestVersion
    throw this._refusal(
      this.message.getMessage('error.ApiVersionLookupUnusable', [
        String(latestVersion),
      ])
    )
  }

  private async _lookUpLatestVersion(): Promise<number> {
    try {
      return await getLatestSupportedVersion()
    } catch (ex) {
      throw this._refusal(this._describeLookupFailure(ex))
    }
  }

  private _refusal(detail: string): ConfigError {
    return new ConfigError(
      this.message.getMessage('error.ApiVersionRetrievalFailed', [detail])
    )
  }

  private _isPinned(): boolean {
    return this.config.apiVersion !== undefined
  }

  // SDR wraps got's RequestError as `cause`; its message carries the code
  // (connect ECONNREFUSED …, connect ETIMEDOUT, getaddrinfo ENOTFOUND …), which is
  // the only thing that tells a proxy misconfiguration from a firewall drop from DNS.
  private _describeLookupFailure(ex: unknown): string {
    const message = getErrorMessage(ex)
    const cause = ex instanceof Error ? ex.cause : undefined
    if (!(cause instanceof Error)) return message
    // Redact before sanitising: the length cap could otherwise cut between the
    // credentials and their '@', leaving a fragment the redaction cannot match.
    return `${message} (${sanitizeForMessage(redactProxyCredentials(cause.message))})`
  }

  protected _sanitizeConfig() {
    this.config.apiVersion = toApiVersion(this.config.apiVersion)
    this.config.repo = sanitizePath(this.config.repo)!
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
