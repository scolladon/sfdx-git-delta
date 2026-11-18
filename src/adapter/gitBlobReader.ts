'use strict'
import type { Readable } from 'node:stream'

import type { FileGitRef } from '../types/git.js'

/**
 * Signal (not Error) used to redirect _executeGitFileCopy from the buffered
 * `getBufferContentOrEscalate` path to the dedicated streaming path. Carries
 * the offending blob's size for size-tiered dispatch telemetry.
 *
 * Deliberately not an Error subclass: zero stack trace allocation, clear
 * flow-control-not-exception semantics at call sites that catch it.
 */
export class EscalateToStreamingSignal {
  public readonly name = 'EscalateToStreamingSignal'
  constructor(
    public readonly size: number,
    public readonly ref: FileGitRef
  ) {}
}

/**
 * Narrow adapter-boundary port consumed by IOExecutor. GitAdapter implements
 * it. The port lets unit tests swap in a fake blob reader without touching
 * the real tsgit-backed object store, while integration tests exercise the
 * real GitAdapter end-to-end.
 */
export interface GitBlobReader {
  getBufferContent(ref: FileGitRef): Promise<Buffer>
  /**
   * Reads ref's blob from the tsgit object store. Rejects with
   * `EscalateToStreamingSignal` when the blob exceeds `SIZE_THRESHOLD` — the
   * caller is expected to catch that signal and route the copy through
   * `streamContent` instead.
   */
  getBufferContentOrEscalate(ref: FileGitRef): Promise<Buffer>
  /**
   * Returns a lazy Readable: nothing is read from the tsgit object store
   * until the consumer reads. It peeks the LFS pointer magic and either
   * forwards the blob stream or (on LFS match) opens the underlying LFS
   * object file.
   */
  streamContent(ref: FileGitRef): Readable
  /**
   * Streams every blob under `<path>` at `<revision>` and yields one
   * `{ path, stream }` per file entry. Directories are filtered out.
   * Entries are lazy: no blob or LFS read happens until the stream is read,
   * and LFS pointers resolve to the local LFS object exactly like
   * `streamContent`.
   * A caller that does not want an entry must `destroy()` it; `resume()`
   * would read it, and an unhandled read error would crash the process.
   */
  streamArchive(
    path: string,
    revision: string
  ): AsyncIterable<{ path: string; stream: Readable }>
}

/**
 * Directory size above which `_executeGitDirCopy` switches from the
 * per-file `getBufferContent` loop to the per-blob `streamArchive` path.
 */
export const GIT_ARCHIVE_DIR_THRESHOLD = 25

export const SIZE_THRESHOLD = 1 * 1024 * 1024
