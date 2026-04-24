import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path/posix'
import { createInterface } from 'node:readline'
import { PassThrough, type Readable } from 'node:stream'

import { SimpleGit, simpleGit } from 'simple-git'
import { TAB } from '../constant/cliConstants.js'
import { UTF8_ENCODING } from '../constant/fsConstants.js'
import {
  ADDITION,
  DELETION,
  HEAD,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  NUM_STAT_CHANGE_INFORMATION,
  RENAMED,
} from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { pushAll } from '../utils/arrayUtils.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { treatPathSep } from '../utils/fsUtils.js'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import { GitBatchCatFile } from './gitBatchCatFile.js'
import type { GitBlobReader, SpawnFn } from './gitBlobReader.js'
import { TreeIndex } from './treeIndex.js'

const LFS_MAGIC = Buffer.from('version https://git-lfs.github.com/spec/v1\n')

const EOL = /\r?\n/
const ROOT_PATHS = new Set(['', '.', './'])

export default class GitAdapter implements GitBlobReader {
  private static instances: Map<string, GitAdapter> = new Map()

  // Keyed by repo+to so spread copies of the same config (e.g. ioExecutor's
  // per-revision {...config, to: rev}) share one adapter instead of spawning
  // a fresh git cat-file subprocess per call.
  private static keyFor(config: Config): string {
    return `${config.repo}\0${config.to}`
  }

  public static getInstance(config: Config): GitAdapter {
    const key = GitAdapter.keyFor(config)
    if (!GitAdapter.instances.has(key)) {
      GitAdapter.instances.set(key, new GitAdapter(config))
    }

    return GitAdapter.instances.get(key)!
  }

  protected readonly simpleGit: SimpleGit
  protected readonly treeIndex: Map<string, TreeIndex>
  protected batchCatFile: GitBatchCatFile | null = null
  // Append-only list of streaming subprocesses. Never queried for membership;
  // iterated at closeAll() teardown and kill()ed if still alive.
  private readonly streamingChildren: ChildProcessWithoutNullStreams[] = []
  private spawnFn: SpawnFn = spawn as SpawnFn

  private constructor(protected readonly config: Config) {
    this.simpleGit = simpleGit({ baseDir: config.repo, trimmed: true })
    this.treeIndex = new Map<string, TreeIndex>()
  }

  /**
   * Testability seam: lets unit tests swap in a fake spawn for streaming
   * subprocesses. Production always uses `child_process.spawn`.
   */
  public setSpawnFn(spawnFn: SpawnFn): void {
    this.spawnFn = spawnFn
  }

  protected getBatchCatFile(): GitBatchCatFile {
    if (!this.batchCatFile) {
      this.batchCatFile = new GitBatchCatFile(this.config.repo, {
        spawnFn: this.spawnFn,
      })
    }
    return this.batchCatFile
  }

  public closeBatchProcess(): void {
    this.batchCatFile?.close()
    this.batchCatFile = null
    for (const child of this.streamingChildren) {
      if (child.exitCode === null && !child.killed) {
        child.kill()
      }
    }
    this.streamingChildren.length = 0
  }

  public static closeAll(): void {
    for (const instance of GitAdapter.instances.values()) {
      instance.closeBatchProcess()
    }
    GitAdapter.instances.clear()
  }

  @log
  public async configureRepository() {
    await this.simpleGit.addConfig('core.longpaths', 'true')
    await this.simpleGit.addConfig('core.quotepath', 'off')
  }

  @log
  public async parseRev(ref: string) {
    return await this.simpleGit.revparse(['--verify', ref])
  }

  @log
  public async preBuildTreeIndex(
    revision: string,
    scopePaths: string[]
  ): Promise<void> {
    if (this.treeIndex.has(revision)) {
      return
    }

    try {
      const args = ['ls-tree', '--name-only', '-r', revision]
      if (scopePaths.length > 0) {
        args.push('--', ...scopePaths)
      }
      const index = new TreeIndex()
      for await (const line of this._spawnLines(args)) {
        if (line) index.add(treatPathSep(line))
      }
      this.treeIndex.set(revision, index)
    } catch (error) {
      Logger.debug(
        lazy`preBuildTreeIndex: scoped ls-tree for '${revision}' failed: ${() => getErrorMessage(error)}`
      )
    }
  }

  /**
   * Spawns `git <args>`, streams stdout through a readline interface, and
   * yields one line at a time. Replaces the old "run command, split on EOL"
   * pattern that accumulated a multi-MB string for megarepo diffs / tree
   * listings before any downstream consumer ran.
   *
   * The spawned child is pushed into streamingChildren so closeAll()
   * kills it if teardown happens mid-stream. stderr is drained to the
   * debug log; a non-zero exit code rejects the iterator on next read.
   */
  protected async *_spawnLines(args: string[]): AsyncGenerator<string> {
    const child = this.spawnFn('git', args, {
      cwd: this.config.repo,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.streamingChildren.push(child)
    const stderrChunks: Buffer[] = []
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))
    const rl = createInterface({
      input: child.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    })
    const exitPromise = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    try {
      for await (const line of rl) {
        yield line
      }
      const code = await exitPromise
      if (code !== 0 && code !== null) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
        throw new Error(
          `git ${args[0]} exited ${code}${stderr ? `: ${stderr}` : ''}`
        )
      }
    } finally {
      rl.close()
      if (!child.killed && child.exitCode === null) child.kill()
    }
  }

  protected pathExistsImpl(path: string, revision: string) {
    const index = this.treeIndex.get(revision)
    if (!index) return false
    if (ROOT_PATHS.has(path)) return index.size > 0
    return index.hasPath(path)
  }

  @log
  public async pathExists(path: string, revision: string = this.config.to) {
    return this.pathExistsImpl(path, revision)
  }

  @log
  public async getFirstCommitRef() {
    return await this.simpleGit.raw(['rev-list', '--max-parents=0', HEAD])
  }

  public async getBufferContent(forRef: FileGitRef): Promise<Buffer> {
    let content = await this.getBatchCatFile().getContent(
      forRef.oid,
      forRef.path
    )

    if (isLFS(content)) {
      const lsfPath = getLFSObjectContentPath(content)
      content = await readFile(join(this.config.repo, lsfPath))
    }
    return content
  }

  public async getBufferContentOrEscalate(forRef: FileGitRef): Promise<Buffer> {
    let content = await this.getBatchCatFile().getContentOrEscalate(
      forRef.oid,
      forRef.path
    )

    if (isLFS(content)) {
      const lsfPath = getLFSObjectContentPath(content)
      content = await readFile(join(this.config.repo, lsfPath))
    }
    return content
  }

  /**
   * Spawns a dedicated `git cat-file blob <oid>` subprocess and returns a
   * Readable that peeks the first chunks for LFS pointer magic. On match,
   * the spawned subprocess is killed and the Readable is fed from the
   * resolved LFS object file. Otherwise bytes are forwarded as-is.
   */
  public streamContent(forRef: FileGitRef): Readable {
    const out = new PassThrough()
    // Defense in depth: `git cat-file blob <ref>` treats a ref starting
    // with `-` as an option. Refs come from git diff output so this
    // shouldn't happen in normal operation, but a malicious diff or a
    // path with a leading dash would give git an option it respects.
    // Fail fast with a clear error rather than trust the subprocess.
    if (forRef.path.startsWith('-') || forRef.oid.startsWith('-')) {
      process.nextTick(() =>
        out.destroy(
          new Error(`Refusing to spawn git cat-file for ${forRef.path}`)
        )
      )
      return out
    }
    const child = this.spawnFn(
      'git',
      ['cat-file', 'blob', `${forRef.oid}:${forRef.path}`],
      { cwd: this.config.repo, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    this.streamingChildren.push(child)
    this._wireStreamContent(child, out, forRef)
    return out
  }

  private _wireStreamContent(
    child: ChildProcessWithoutNullStreams,
    out: PassThrough,
    forRef: FileGitRef
  ): void {
    let peeked: Buffer[] = []
    let peekedLen = 0
    let decided = false

    const forwardPeeked = () => {
      const head = Buffer.concat(peeked, peekedLen)
      peeked = []
      peekedLen = 0
      return head
    }

    const onChunk = (chunk: Buffer) => {
      if (decided) {
        if (!out.write(chunk)) child.stdout.pause()
        return
      }
      peeked.push(chunk)
      peekedLen += chunk.length
      if (peekedLen < LFS_MAGIC.length) return
      decided = true
      const head = forwardPeeked()
      if (head.subarray(0, LFS_MAGIC.length).equals(LFS_MAGIC)) {
        this._handoffToLfs(child, out, head)
        return
      }
      if (!out.write(head)) child.stdout.pause()
    }

    child.stdout.on('data', onChunk)
    out.on('drain', () => child.stdout.resume())
    child.stdout.on('end', () => {
      if (!decided && peekedLen > 0) {
        out.write(forwardPeeked())
      }
      if (decided || peekedLen === 0) out.end()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      Logger.debug(
        lazy`streamContent stderr for ${forRef.path}: ${() => chunk.toString()}`
      )
    })
    child.on('error', err => out.destroy(err))
    child.on('close', code => {
      if (code !== 0 && !out.destroyed) {
        out.destroy(new Error(`git cat-file blob exited ${code}`))
      }
    })
  }

  private _handoffToLfs(
    child: ChildProcessWithoutNullStreams,
    out: PassThrough,
    head: Buffer
  ): void {
    const pointerParts: Buffer[] = [head]
    child.stdout.removeAllListeners('data')
    child.stdout.on('data', (c: Buffer) => pointerParts.push(c))
    child.stdout.on('end', () => {
      const pointer = Buffer.concat(pointerParts)
      const lfsPath = getLFSObjectContentPath(pointer)
      createReadStream(join(this.config.repo, lfsPath))
        .on('error', err => out.destroy(err))
        .pipe(out)
    })
    if (!child.killed) child.kill()
  }

  @log
  public async getStringContent(forRef: FileGitRef): Promise<string> {
    const content = await this.getBufferContent(forRef)
    return content.toString(UTF8_ENCODING)
  }

  protected getFilesPathCached(path: string, revision: string): string[] {
    const index = this.treeIndex.get(revision)
    if (!index) return []
    if (ROOT_PATHS.has(path)) return index.allPaths()
    if (index.has(path)) return [path]
    return index.getFilesUnder(path)
  }

  @log
  public async getFilesPath(
    paths: string | string[],
    revision: string = this.config.to
  ): Promise<string[]> {
    if (typeof paths === 'string') {
      return this.getFilesPathCached(paths, revision)
    }

    const result: string[] = []
    for (const path of paths) {
      pushAll(result, this.getFilesPathCached(path, revision))
    }

    return result
  }

  @log
  public async listDirAtRevision(
    dir: string,
    revision: string
  ): Promise<string[]> {
    const index = this.treeIndex.get(revision)
    if (!index) return []
    return index.listChildren(dir)
  }

  @log
  public async gitGrep(
    pattern: string,
    path: string | string[],
    revision: string = this.config.to
  ): Promise<string[]> {
    try {
      const paths = Array.isArray(path) ? path : [path]
      const result = await this.simpleGit.raw([
        'grep',
        '-l',
        pattern,
        revision,
        '--',
        ...paths,
      ])
      return result
        .split(EOL)
        .filter(line => line)
        .map(line => treatPathSep(line.slice(line.indexOf(':') + 1)))
    } catch (error) {
      Logger.debug(
        lazy`gitGrep: grep for '${pattern}' in '${path}' at '${revision}' failed: ${() => getErrorMessage(error)}`
      )
      return []
    }
  }

  // Fast path (no whitespace ignore): one `git diff --name-status` call.
  // Rename detection (`-M` + `R` filter) is gated behind
  // `config.changesManifest` so the default sgd pipeline emits the same
  // A/M/D line shape as before this feature. When enabled, renames surface
  // as `R<score>\tfrom\tto` lines that RepoGitDiff splits into synthetic
  // A/D while recording the rename pair for ChangeSet.
  //
  // Whitespace path: three (or four, when rename detection is on) parallel
  // `git diff --numstat` calls, one per --diff-filter. `--name-status` does
  // NOT honor `--ignore-all-space` (git decides A/M/D from blob SHAs for
  // that mode, so a whitespace-only change still appears as `M`). Only
  // `--numstat` computes a real content diff under the whitespace flags,
  // so files with 0/0 line changes drop out naturally. When rename
  // detection is enabled the R call uses `-z` so it can sidestep numstat's
  // brace/arrow rename-path encoding.
  //
  // The Promise.all fans out to 4 items with rename detection on. That's a
  // localised exception to the CLAUDE.local.md ≤3 bounded-Promise.all
  // guideline: the four `--diff-filter`s are the canonical per-kind split,
  // so hiding R as an out-of-band sequential await just obscures the real
  // symmetric fan-out without changing the resource footprint.
  @log
  public async getDiffLines(): Promise<string[]> {
    const detectRenames = Boolean(this.config.changesManifest)

    if (!this.config.ignoreWhitespace) {
      const output = await this.simpleGit.raw([
        'diff',
        '--name-status',
        ...(detectRenames ? ['-M'] : ['--no-renames']),
        `--diff-filter=${detectRenames ? 'AMDR' : 'AMD'}`,
        this.config.from,
        this.config.to,
        '--',
        ...this.config.source,
      ])
      return output
        .split(EOL)
        .filter(Boolean)
        .map(line => treatPathSep(line))
    }

    // When rename detection is on, the A/M/D filters also run with -M so
    // renamed files drop out (reclassified to R by git), and the dedicated
    // R call is the single source of rename lines — no dedup needed.
    // Without rename detection, A/M/D keep their pre-feature line shape via
    // --no-renames.
    const filters = detectRenames
      ? ([ADDITION, MODIFICATION, DELETION, RENAMED] as const)
      : ([ADDITION, MODIFICATION, DELETION] as const)

    const results = await Promise.all(
      filters.map(changeType =>
        this._getNumstatLines(changeType, detectRenames)
      )
    )
    return results.flat()
  }

  // Per-filter numstat call. The R branch uses `-z` because numstat
  // otherwise encodes rename paths in three format variants within the
  // path column (`{a => b}`, `a/{b => c}/d`, or bare `old => new`). `-z`
  // emits `N<TAB>M<TAB>\0<src>\0<dst>\0` for each rename, so we can
  // stride-3 over the NUL-split tokens and synthesise
  // `R<TAB><src><TAB><dst>` lines that RepoGitDiff._expandRenames
  // already understands. A/M/D use the default output and rewrite the
  // leading `N\tM\t` counts into the status prefix.
  protected async _getNumstatLines(
    changeType: string,
    detectRenames: boolean
  ): Promise<string[]> {
    const isRename = changeType === RENAMED
    const output = await this.simpleGit.raw([
      'diff',
      '--numstat',
      ...(isRename ? ['-M', '-z'] : detectRenames ? ['-M'] : ['--no-renames']),
      ...IGNORE_WHITESPACE_PARAMS,
      `--diff-filter=${changeType}`,
      this.config.from,
      this.config.to,
      '--',
      ...this.config.source,
    ])

    if (isRename) {
      const tokens = output.split('\0')
      const lines: string[] = []
      for (let i = 0; i + 2 < tokens.length; i += 3) {
        const src = tokens[i + 1]
        const dst = tokens[i + 2]
        if (!src || !dst) continue
        lines.push(treatPathSep(`${RENAMED}${TAB}${src}${TAB}${dst}`))
      }
      return lines
    }

    return output
      .split(EOL)
      .filter(Boolean)
      .map(line =>
        treatPathSep(
          line.replace(NUM_STAT_CHANGE_INFORMATION, `${changeType}\t`)
        )
      )
  }
}
