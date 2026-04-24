'use strict'
import { createWriteStream, promises as fsPromises } from 'node:fs'
import { dirname, join } from 'node:path/posix'
import type { Writable } from 'node:stream'

import { eachLimit } from 'async'
import { outputFile } from 'fs-extra'

import type { Config } from '../types/config.js'
import type {
  CopyOperation,
  StreamedContentOperation,
} from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { buildIgnoreHelper, type IgnoreHelper } from '../utils/ignoreHelper.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import GitAdapter from './GitAdapter.js'

const TMP_SUFFIX = '.tmp'

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
      case CopyOperationKind.StreamedContent:
        await this._executeStreamedContent(op)
        break
    }
  }

  protected _getGitAdapter(revision: string): GitAdapter {
    const config =
      revision !== this.config.to
        ? { ...this.config, to: revision }
        : this.config
    return GitAdapter.getInstance(config)
  }

  protected async _executeGitFileCopy(op: {
    path: string
    revision: string
  }): Promise<void> {
    try {
      const gitAdapter = this._getGitAdapter(op.revision)
      const content = await gitAdapter.getBufferContent({
        path: op.path,
        oid: op.revision,
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
      const gitAdapter = this._getGitAdapter(op.revision)
      const filePaths = await gitAdapter.getFilesPath(op.path)
      for (const filePath of filePaths) {
        if (this.ignoreHelper.globalIgnore.ignores(filePath)) {
          continue
        }
        const content = await gitAdapter.getBufferContent({
          path: filePath,
          oid: op.revision,
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

  protected async _executeStreamedContent(
    op: StreamedContentOperation
  ): Promise<void> {
    const dst = join(this.config.output, op.path)
    await this._writeAtomicallyViaTmp(dst, op.writer)
  }

  // Writes `producer` output to a sibling `.tmp` file, then atomically renames
  // on success. Same-directory tmp avoids EXDEV on cross-filesystem moves
  // (Docker-on-CI overlayfs + tmpfs /tmp scenario). Errors destroy the stream,
  // unlink the tmp, and log at debug — matching _executeGitFileCopy precedent.
  protected async _writeAtomicallyViaTmp(
    dst: string,
    producer: (ws: Writable) => Promise<void>
  ): Promise<void> {
    const tmp = `${dst}${TMP_SUFFIX}`
    await fsPromises.mkdir(dirname(dst), { recursive: true })
    const ws = createWriteStream(tmp)
    try {
      await producer(ws)
      await new Promise<void>((resolve, reject) => {
        ws.end((err?: Error | null) => (err ? reject(err) : resolve()))
      })
      await fsPromises.rename(tmp, dst)
    } catch (error) {
      ws.destroy()
      await fsPromises.unlink(tmp).catch(() => undefined)
      Logger.debug(
        lazy`IOExecutor atomicWrite failed for ${dst}: ${() => getErrorMessage(error)}`
      )
    }
  }
}
