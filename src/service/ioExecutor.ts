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
    if (!this.config.generateDelta) {
      return
    }
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
        await this._executeGitCopy(op)
        break
      case CopyOperationKind.ComputedContent:
        await this._executeComputedContent(op)
        break
    }
  }

  protected async _executeGitCopy(op: {
    path: string
    revision: string
  }): Promise<void> {
    try {
      const config =
        op.revision !== this.config.to
          ? { ...this.config, to: op.revision }
          : this.config
      const gitAdapter = GitAdapter.getInstance(config)
      for await (const file of gitAdapter.getFilesFrom(op.path)) {
        const dst = join(this.config.output, file.path)
        await outputFile(dst, file.content)
        this.processedPaths.add(file.path)
      }
    } catch (error) {
      Logger.debug(
        lazy`IOExecutor gitCopy failed for ${op.path}: ${getErrorMessage(error)}`
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
