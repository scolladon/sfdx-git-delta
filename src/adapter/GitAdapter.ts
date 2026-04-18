import { readFile } from 'node:fs/promises'
import { join } from 'node:path/posix'
import { SimpleGit, simpleGit } from 'simple-git'
import { UTF8_ENCODING } from '../constant/fsConstants.js'
import {
  ADDITION,
  DELETION,
  HEAD,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  NUM_STAT_CHANGE_INFORMATION,
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
import { TreeIndex } from './treeIndex.js'

const EOL = /\r?\n/
const ROOT_PATHS = new Set(['', '.', './'])

export default class GitAdapter {
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

  private constructor(protected readonly config: Config) {
    this.simpleGit = simpleGit({ baseDir: config.repo, trimmed: true })
    this.treeIndex = new Map<string, TreeIndex>()
  }

  protected getBatchCatFile(): GitBatchCatFile {
    if (!this.batchCatFile) {
      this.batchCatFile = new GitBatchCatFile(this.config.repo)
    }
    return this.batchCatFile
  }

  public closeBatchProcess(): void {
    this.batchCatFile?.close()
    this.batchCatFile = null
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
      const output = await this.simpleGit.raw(args)
      const index = new TreeIndex()
      for (const line of output.split(EOL)) {
        if (line) index.add(treatPathSep(line))
      }
      this.treeIndex.set(revision, index)
    } catch (error) {
      Logger.debug(
        lazy`preBuildTreeIndex: scoped ls-tree for '${revision}' failed: ${() => getErrorMessage(error)}`
      )
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
  //
  // Whitespace path: three parallel `git diff --numstat --diff-filter=X`
  // calls. `--name-status` does NOT honor `--ignore-all-space` — git decides
  // A/M/D from blob SHAs for that mode, so a whitespace-only change still
  // appears as `M`. Only `--numstat` computes a real content diff under the
  // whitespace flags, so files with 0/0 line changes drop out naturally.
  // A and D can't produce whitespace-only false positives, so the expensive
  // path is only needed to correctly filter M.
  @log
  public async getDiffLines(): Promise<string[]> {
    if (!this.config.ignoreWhitespace) {
      const output = await this.simpleGit.raw([
        'diff',
        '--name-status',
        '--no-renames',
        '--diff-filter=AMD',
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

    const results = await Promise.all(
      [ADDITION, MODIFICATION, DELETION].map(async changeType => {
        const output = await this.simpleGit.raw([
          'diff',
          '--numstat',
          '--no-renames',
          ...IGNORE_WHITESPACE_PARAMS,
          `--diff-filter=${changeType}`,
          this.config.from,
          this.config.to,
          '--',
          ...this.config.source,
        ])
        return output
          .split(EOL)
          .filter(Boolean)
          .map(line =>
            treatPathSep(
              line.replace(NUM_STAT_CHANGE_INFORMATION, `${changeType}\t`)
            )
          )
      })
    )
    return results.flat()
  }
}
