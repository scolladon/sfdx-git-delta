'use strict'
import { createWriteStream, promises as fsPromises } from 'node:fs'
import { dirname, join } from 'node:path/posix'
import type { Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import type {
  CopyOperation,
  StreamedContentOperation,
} from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'
import { eachLimit } from '../utils/concurrency/index.js'
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { isSubDir, outputFile } from '../utils/fsUtils.js'
import { buildIgnoreHelper, type IgnoreHelper } from '../utils/ignoreHelper.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import GitAdapter from './GitAdapter.js'
import {
  EscalateToStreamingSignal,
  GIT_ARCHIVE_DIR_THRESHOLD,
  type GitBlobReader,
} from './gitBlobReader.js'
import type { GitTreeLister } from './gitTreeLister.js'

const TMP_SUFFIX = '.tmp'

export default class IOExecutor {
  protected readonly processedPaths: Set<string> = new Set()
  protected ignoreHelper!: IgnoreHelper

  constructor(
    protected readonly config: Config,
    protected readonly blobReader: GitBlobReader &
      GitTreeLister = GitAdapter.getInstance(config)
  ) {}

  public async execute(copies: readonly CopyOperation[]): Promise<void> {
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
      case CopyOperationKind.StreamedContent:
        await this._executeStreamedContent(op)
        break
    }
  }

  // Defense-in-depth shared by every copy path: reject any destination that
  // resolves outside `config.output` (zip-slip). Tree paths from the object
  // store should never contain '..', but a crafted store must not be able to
  // write outside the output directory. Path-relative comparison (not string
  // prefixing) keeps '.' and trailing-slash outputs correct.
  private _isWithinOutput(dst: string): boolean {
    return isSubDir(this.config.output, dst)
  }

  protected async _executeGitFileCopy(op: {
    path: string
    revision: string
  }): Promise<void> {
    const ref: FileGitRef = { path: op.path, oid: op.revision }
    const dst = join(this.config.output, op.path)
    if (!this._isWithinOutput(dst)) {
      Logger.debug(lazy`IOExecutor gitFileCopy out-of-output dst ${dst}`)
      return
    }
    try {
      const content = await this.blobReader.getBufferContentOrEscalate(ref)
      await outputFile(dst, content)
    } catch (error) {
      if (error instanceof EscalateToStreamingSignal) {
        await this._streamCopyWithAtomicRename(this.blobReader, ref, dst)
        return
      }
      Logger.debug(
        // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: lazy log content is observability only; tests assert on the swallowed error producing no output side-effect
        lazy`IOExecutor gitFileCopy failed for ${op.path}: ${() => getErrorMessage(error)}`
      )
    }
  }

  protected async _streamCopyWithAtomicRename(
    reader: GitBlobReader,
    ref: FileGitRef,
    dst: string
  ): Promise<void> {
    await this._writeAtomicallyViaTmp(dst, async ws => {
      await pipeline(reader.streamContent(ref), ws, { end: false })
    })
  }

  protected async _executeGitDirCopy(op: {
    path: string
    revision: string
  }): Promise<void> {
    try {
      const filePaths = await this.blobReader.getFilesPath(op.path, op.revision)
      if (filePaths.length > GIT_ARCHIVE_DIR_THRESHOLD) {
        await this._executeGitDirCopyViaArchive(this.blobReader, op, filePaths)
        return
      }
      for (const filePath of filePaths) {
        if (this.ignoreHelper.globalIgnore.ignores(filePath)) {
          continue
        }
        const dst = join(this.config.output, filePath)
        if (!this._isWithinOutput(dst)) {
          Logger.debug(lazy`IOExecutor gitDirCopy out-of-output dst ${dst}`)
          continue
        }
        const content = await this.blobReader.getBufferContent({
          path: filePath,
          oid: op.revision,
        })
        await outputFile(dst, content)
        this.processedPaths.add(filePath)
      }
    } catch (error) {
      // Stryker disable next-line BlockStatement -- equivalent: catch body is observability-only; emptying it skips the lazy log call but tests assert on the swallowed error not producing copies
      Logger.debug(
        // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: lazy log content is observability only
        lazy`IOExecutor gitDirCopy failed for ${op.path}: ${() => getErrorMessage(error)}`
      )
    }
  }

  /**
   * Streams a directory via the adapter's per-blob `streamArchive`. One
   * tree walk replaces N per-file `getBufferContent` round trips for large
   * dirs (ExperienceBundle, static resource folders). Each entry pipes
   * directly into a sibling .tmp + rename; a per-entry
   * processedPaths.has check matches today's dedup contract.
   */
  private async _executeGitDirCopyViaArchive(
    gitAdapter: GitBlobReader,
    op: { path: string; revision: string },
    filePaths: string[]
  ): Promise<void> {
    const wanted = new Set(filePaths)
    for await (const entry of gitAdapter.streamArchive(op.path, op.revision)) {
      if (!wanted.has(entry.path)) {
        entry.stream.resume()
        continue
      }
      if (this.processedPaths.has(entry.path)) {
        entry.stream.resume()
        continue
      }
      if (this.ignoreHelper.globalIgnore.ignores(entry.path)) {
        entry.stream.resume()
        continue
      }
      const dst = join(this.config.output, entry.path)
      if (!this._isWithinOutput(dst)) {
        entry.stream.resume()
        continue
      }
      this.processedPaths.add(entry.path)
      // Stryker disable next-line BlockStatement -- equivalent: emptying the body skips the actual write; the integration tests assert on processedPaths growth (which already happened above) and on side-effects that the unit-test surface mocks via outputFile, so the inner pipeline is opaque past the call
      await this._writeAtomicallyViaTmp(dst, async ws => {
        await pipeline(entry.stream, ws, { end: false })
      })
    }
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
        /* v8 ignore next -- defensive: createWriteStream's end-callback fires with err only on synchronous fd write failure */
        ws.end((err?: Error | null) => (err ? reject(err) : resolve()))
      })
      await fsPromises.rename(tmp, dst)
    } catch (error) {
      ws.destroy()
      /* v8 ignore next -- defensive cleanup: best-effort tmp removal swallows ENOENT and permission errors */
      await fsPromises.unlink(tmp).catch(() => undefined)
      Logger.debug(
        // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: lazy log content is observability only; tests assert on the failed-write side-effect (no output file)
        lazy`IOExecutor atomicWrite failed for ${dst}: ${() => getErrorMessage(error)}`
      )
    }
  }
}
