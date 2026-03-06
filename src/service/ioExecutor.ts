'use strict'
import { join } from 'node:path/posix'

import { eachLimit } from 'async'
import { outputFile } from 'fs-extra'

import GitAdapter from '../adapter/GitAdapter.js'
import type { Config } from '../types/config.js'
import type { CopyOperation } from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { buildIgnoreHelper, type IgnoreHelper } from '../utils/ignoreHelper.js'
import { Logger, lazy } from '../utils/LoggingService.js'

export default class IOExecutor {
  protected readonly processedPaths: Set<string> = new Set()
  protected ignoreHelper!: IgnoreHelper

  constructor(protected readonly config: Config) {}

  public async execute(copies: CopyOperation[]): Promise<void> {
    this.ignoreHelper = await buildIgnoreHelper(this.config)
    await eachLimit(
      copies,
      getConcurrencyThreshold(),
      async (op: CopyOperation) => {
        await this._executeOperation(op)
      }
    )
  }

  protected async _executeOperation(op: CopyOperation): Promise<void> {
    if (this.processedPaths.has(op.path)) {
      return
    }
    this.processedPaths.add(op.path)

    if (this.ignoreHelper.globalIgnore.ignores(op.path)) {
      return
    }

    switch (op.kind) {
      case CopyOperationKind.GitCopy:
        await this._executeGitFileCopy(op)
        break
      case CopyOperationKind.GitDirCopy:
        await this._executeGitDirCopy(op)
        break
      case CopyOperationKind.ComputedContent:
        await this._executeComputedContent(op)
        break
    }
  }

  protected async _executeGitFileCopy(op: {
    path: string
    revision: string
  }): Promise<void> {
    try {
      const config =
        op.revision !== this.config.to
          ? { ...this.config, to: op.revision }
          : this.config
      const gitAdapter = GitAdapter.getInstance(config)
      const content = await gitAdapter.getBufferContent({
        path: op.path,
        oid: config.to,
      })
      const dst = join(this.config.output, op.path)
      await outputFile(dst, content)
    } catch (error) {
      Logger.debug(
        lazy`IOExecutor gitFileCopy failed for ${op.path}: ${() => getErrorMessage(error)}`
      )
    }
  }

  protected async _executeGitDirCopy(op: {
    path: string
    revision: string
  }): Promise<void> {
    try {
      const config =
        op.revision !== this.config.to
          ? { ...this.config, to: op.revision }
          : this.config
      const gitAdapter = GitAdapter.getInstance(config)
      const filePaths = await gitAdapter.getFilesPath(op.path)
      for (const filePath of filePaths) {
        const content = await gitAdapter.getBufferContent({
          path: filePath,
          oid: config.to,
        })
        const dst = join(this.config.output, filePath)
        await outputFile(dst, content)
        this.processedPaths.add(filePath)
      }
    } catch (error) {
      Logger.debug(
        lazy`IOExecutor gitDirCopy failed for ${op.path}: ${() => getErrorMessage(error)}`
      )
    }
  }

  protected async _executeComputedContent(op: {
    path: string
    content: string
  }): Promise<void> {
    await outputFile(join(this.config.output, op.path), op.content)
  }
}
