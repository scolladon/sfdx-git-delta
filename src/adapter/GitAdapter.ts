import { readFile } from 'node:fs/promises'
import { join } from 'node:path/posix'
import { SimpleGit, simpleGit } from 'simple-git'
import { PATH_SEP, UTF8_ENCODING } from '../constant/fsConstants.js'
import {
  ADDITION,
  BLOB_TYPE,
  DELETION,
  HEAD,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  TREE_TYPE,
} from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { treatPathSep } from '../utils/fsUtils.js'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'

const EOL = new RegExp(/\r?\n/)

const revPath = (pathDef: FileGitRef) => `${pathDef.oid}:${pathDef.path}`
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
  protected readonly getFilesPathCache: Map<string, Set<string>>
  protected readonly pathExistsCache: Map<string, boolean>

  private constructor(protected readonly config: Config) {
    this.simpleGit = simpleGit({ baseDir: config.repo, trimmed: true })
    this.getFilesPathCache = new Map<string, Set<string>>()
    this.pathExistsCache = new Map<string, boolean>()
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

  protected async pathExistsImpl(path: string, revision: string) {
    let doesPathExists = false
    try {
      const type = await this.simpleGit.catFile([
        '-t',
        revPath({ path, oid: revision }),
      ])
      doesPathExists = [TREE_TYPE, BLOB_TYPE].includes(type.trimEnd())
    } catch (error) {
      Logger.debug(
        lazy`pathExistsImpl: path '${path}' at revision '${revision}' not found: ${() => getErrorMessage(error)}`
      )
      doesPathExists = false
    }
    return doesPathExists
  }

  @log
  public async pathExists(path: string, revision: string = this.config.to) {
    const cacheKey = `${revision}:${path}`
    if (this.pathExistsCache.has(cacheKey)) {
      return this.pathExistsCache.get(cacheKey)!
    }
    const doesPathExists = await this.pathExistsImpl(path, revision)
    this.pathExistsCache.set(cacheKey, doesPathExists)
    return doesPathExists
  }

  @log
  public async getFirstCommitRef() {
    return await this.simpleGit.raw(['rev-list', '--max-parents=0', HEAD])
  }

  protected async getBufferContent(forRef: FileGitRef): Promise<Buffer> {
    let content: Buffer = await this.simpleGit.showBuffer(revPath(forRef))

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

  protected async getFilesPathImpl(
    path: string,
    revision: string
  ): Promise<string[]> {
    return (
      await this.simpleGit.raw([
        'ls-tree',
        '--name-only',
        '-r',
        revision,
        path || '.',
      ])
    )
      .split(EOL)
      .filter(line => line)
      .map(line => treatPathSep(line))
  }

  protected async getFilesPathCached(
    path: string,
    revision: string
  ): Promise<string[]> {
    const cacheKey = `${revision}:${path}`
    if (this.getFilesPathCache.has(cacheKey)) {
      return Array.from(this.getFilesPathCache.get(cacheKey)!)
    }

    const filesPath = await this.getFilesPathImpl(path, revision)
    const pathSegmentsLength = path.split(PATH_SEP).length

    // Start iterating over each filePath
    for (const filePath of filesPath) {
      const relevantSegments = filePath
        .split(PATH_SEP)
        .slice(pathSegmentsLength)

      // Only cache the sub-paths for relevant files starting from the given path
      const subPathSegments = [path]
      for (const segment of relevantSegments) {
        subPathSegments.push(segment)
        const currentPath = `${revision}:${subPathSegments.join(PATH_SEP)}`
        if (!this.getFilesPathCache.has(currentPath)) {
          this.getFilesPathCache.set(currentPath, new Set())
        }
        this.getFilesPathCache.get(currentPath)!.add(filePath)
      }
    }

    // Store the full set of file paths for the given path in cache
    this.getFilesPathCache.set(cacheKey, new Set(filesPath))

    return filesPath
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
      result.push(...filesPath)
    }

    return result
  }

  @log
  public async listDirAtRevision(
    dir: string,
    revision: string
  ): Promise<string[]> {
    try {
      const output = await this.simpleGit.raw([
        'ls-tree',
        '--name-only',
        revision,
        dir ? `${dir}/` : '.',
      ])
      return output
        .split(EOL)
        .filter(line => line && line.startsWith(dir))
        .map(line => line.split(PATH_SEP).pop()!)
        .filter(name => name)
    } catch (error) {
      Logger.debug(
        lazy`listDirAtRevision: failed to list '${dir}' at '${revision}': ${() => getErrorMessage(error)}`
      )
      return []
    }
  }

  public async *getFilesFrom(path: string) {
    const filesPath = await this.getFilesPath(path)
    for (const filePath of filesPath) {
      const fileContent = await this.getBufferContent({
        path: filePath,
        oid: this.config.to,
      })
      yield {
        path: filePath,
        content: fileContent,
      }
    }
  }

  @log
  public async gitGrep(
    pattern: string,
    path: string,
    revision: string = this.config.to
  ): Promise<string[]> {
    try {
      const result = await this.simpleGit.raw([
        'grep',
        '-l',
        pattern,
        revision,
        '--',
        path,
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
    const output = await this.simpleGit.raw([
      'diff',
      '--name-status',
      '--no-renames',
      ...(this.config.ignoreWhitespace ? IGNORE_WHITESPACE_PARAMS : []),
      `--diff-filter=${ADDITION}${MODIFICATION}${DELETION}`,
      this.config.from,
      this.config.to,
      '--',
      ...this.config.source,
    ])
    return output.split(EOL).filter(Boolean).map(treatPathSep)
  }
}
