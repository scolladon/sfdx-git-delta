import { readFile } from 'node:fs/promises'
import { join } from 'node:path/posix'
import { SimpleGit, simpleGit } from 'simple-git'
import { PATH_SEP, UTF8_ENCODING } from '../constant/fsConstants.js'
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

const EOL = new RegExp(/\r?\n/)
const ROOT_PATHS = new Set(['', '.', './'])

export default class GitAdapter {
  private static instances: Map<Config, GitAdapter> = new Map()

  public static getInstance(config: Config): GitAdapter {
    if (!GitAdapter.instances.has(config)) {
      const instance = new GitAdapter(config)
      GitAdapter.instances.set(config, instance)
    }

    return GitAdapter.instances.get(config)!
  }

  protected readonly simpleGit: SimpleGit
  protected readonly treeIndex: Map<string, Set<string>>
  protected batchCatFile: GitBatchCatFile | null = null

  private constructor(protected readonly config: Config) {
    this.simpleGit = simpleGit({ baseDir: config.repo, trimmed: true })
    this.treeIndex = new Map<string, Set<string>>()
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

  protected async buildTreeIndex(revision: string): Promise<Set<string>> {
    if (this.treeIndex.has(revision)) {
      return this.treeIndex.get(revision)!
    }

    const output = await this.simpleGit.raw([
      'ls-tree',
      '--name-only',
      '-r',
      revision,
    ])
    const files = new Set(
      output
        .split(EOL)
        .filter(line => line)
        .map(line => treatPathSep(line))
    )
    this.treeIndex.set(revision, files)
    return files
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
      const files = new Set(
        output
          .split(EOL)
          .filter(line => line)
          .map(line => treatPathSep(line))
      )
      this.treeIndex.set(revision, files)
    } catch (error) {
      Logger.debug(
        lazy`preBuildTreeIndex: scoped ls-tree for '${revision}' failed: ${() => getErrorMessage(error)}`
      )
    }
  }

  protected async pathExistsImpl(path: string, revision: string) {
    try {
      const index = await this.buildTreeIndex(revision)
      if (ROOT_PATHS.has(path)) {
        return index.size > 0
      }
      if (index.has(path)) {
        return true
      }
      const dirPrefix = `${path}${PATH_SEP}`
      for (const filePath of index) {
        if (filePath.startsWith(dirPrefix)) {
          return true
        }
      }
      return false
    } catch (error) {
      Logger.debug(
        lazy`pathExistsImpl: path '${path}' at revision '${revision}' not found: ${() => getErrorMessage(error)}`
      )
      return false
    }
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

  protected async getFilesPathCached(
    path: string,
    revision: string
  ): Promise<string[]> {
    const index = await this.buildTreeIndex(revision)
    if (ROOT_PATHS.has(path)) {
      return Array.from(index)
    }
    if (index.has(path)) {
      return [path]
    }
    const dirPrefix = `${path}${PATH_SEP}`
    const result: string[] = []
    for (const filePath of index) {
      if (filePath.startsWith(dirPrefix)) {
        result.push(filePath)
      }
    }
    return result
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
      const filesPath = await this.getFilesPathCached(path, revision)
      pushAll(result, filesPath)
    }

    return result
  }

  @log
  public async listDirAtRevision(
    dir: string,
    revision: string
  ): Promise<string[]> {
    try {
      const index = await this.buildTreeIndex(revision)
      const dirPrefix = dir ? `${dir}${PATH_SEP}` : ''
      const children = new Set<string>()
      for (const filePath of index) {
        if (filePath.startsWith(dirPrefix)) {
          const rest = filePath.slice(dirPrefix.length)
          const firstSegment = rest.split(PATH_SEP)[0]
          children.add(firstSegment)
        }
      }
      return Array.from(children)
    } catch (error) {
      Logger.debug(
        lazy`listDirAtRevision: failed to list '${dir}' at '${revision}': ${() => getErrorMessage(error)}`
      )
      return []
    }
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

  @log
  public async getDiffLines(): Promise<string[]> {
    const results = await Promise.all(
      [ADDITION, MODIFICATION, DELETION].map(async changeType => {
        const output = await this.simpleGit.raw([
          'diff',
          '--numstat',
          '--no-renames',
          ...(this.config.ignoreWhitespace ? IGNORE_WHITESPACE_PARAMS : []),
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
