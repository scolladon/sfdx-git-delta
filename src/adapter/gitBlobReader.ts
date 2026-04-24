'use strict'
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptions,
} from 'node:child_process'
import type { Readable } from 'node:stream'

import type { FileGitRef } from '../types/git.js'

export type SpawnFn = (
  cmd: string,
  args: string[],
  opts: SpawnOptions
) => ChildProcessWithoutNullStreams

/**
 * Signal (not Error) used to redirect _executeGitFileCopy from the buffered
 * batch-cat-file path to the dedicated streaming path. Carries the offending
 * blob's size for size-tiered dispatch telemetry.
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
 * it. The port lets unit tests swap in a fake blob reader without spawning
 * real `git cat-file` subprocesses, while integration tests exercise the
 * real GitAdapter end-to-end.
 */
export interface GitBlobReader {
  getBufferContent(ref: FileGitRef): Promise<Buffer>
  /**
   * Reads ref's blob via the batched cat-file subprocess. Rejects with
   * `EscalateToStreamingSignal` when the blob exceeds `SIZE_THRESHOLD` — the
   * caller is expected to catch that signal and route the copy through
   * `streamContent` instead.
   */
  getBufferContentOrEscalate(ref: FileGitRef): Promise<Buffer>
  /**
   * Spawns a dedicated `git cat-file blob <oid>` subprocess, peeks the LFS
   * pointer magic, and returns a Readable that either forwards the blob
   * stream or (on LFS match) opens the underlying LFS object file.
   */
  streamContent(ref: FileGitRef): Readable
  /**
   * Streams `git archive --format=tar <revision> -- <path>` and yields one
   * `{ path, stream }` per file entry. Directories are filtered out.
   * Callers must consume every yielded stream (or call stream.resume() to
   * drain-and-discard) otherwise tar-stream back-pressures.
   */
  streamArchive(
    path: string,
    revision: string
  ): AsyncIterable<{ path: string; stream: Readable }>
}

/**
 * Directory size above which `_executeGitDirCopy` switches to the
 * git-archive streaming path. Small directories keep the existing
 * batch-cat-file loop (fork+exec cost of git archive isn't worth
 * paying for a handful of files).
 */
export const GIT_ARCHIVE_DIR_THRESHOLD = 25

export const SIZE_THRESHOLD = 1 * 1024 * 1024
