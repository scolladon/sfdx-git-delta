import { join } from 'node:path/posix'

import { SimpleGit, simpleGit } from 'simple-git'

import { TAB } from '../constant/cliConstants.js'
import { PATH_SEP, UTF8_ENCODING } from '../constant/fsConstants.js'
import {
  ADDITION,
  BLOB_TYPE,
  DELETION,
  HEAD,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  NUM_STAT_CHANGE_INFORMATION,
  TREE_TYPE,
} from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { treatPathSep } from '../utils/fsUtils.js'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper.js'

import { readFile } from 'node:fs/promises'

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

  public async configureRepository() {
    await this.simpleGit.addConfig('core.longpaths', 'true')
    await this.simpleGit.addConfig('core.quotepath', 'off')
  }

  public async parseRev(ref: string) {
    return await this.simpleGit.revparse(['--verify', ref])
  }

  protected async pathExistsImpl(path: string) {
    let doesPathExists = false
    try {
      const type = await this.simpleGit.catFile([
        '-t',
        revPath({ path, oid: this.config.to }),
      ])
      doesPathExists = [TREE_TYPE, BLOB_TYPE].includes(type.trimEnd())
    } catch {
      doesPathExists = false
    }
    return doesPathExists
  }

  public async pathExists(path: string) {
    if (this.pathExistsCache.has(path)) {
      return this.pathExistsCache.get(path)
    }
    const doesPathExists = await this.pathExistsImpl(path)
    this.pathExistsCache.set(path, doesPathExists)
    return doesPathExists
  }

  public async getFirstCommitRef() {
    return await this.simpleGit.raw(['rev-list', '--max-parents=0', 'HEAD'])
  }

  protected async getBufferContent(forRef: FileGitRef): Promise<Buffer> {
    let content: Buffer = await this.simpleGit.showBuffer(revPath(forRef))

    if (isLFS(content)) {
      const lsfPath = getLFSObjectContentPath(content)
      content = await readFile(join(this.config.repo, lsfPath))
    }
    return content
  }

  public async getStringContent(forRef: FileGitRef): Promise<string> {
    const content = await this.getBufferContent(forRef)
    return content.toString(UTF8_ENCODING)
  }

  protected async getFilesPathImpl(path: string): Promise<string[]> {
    return (
      await this.simpleGit.raw([
        'ls-tree',
        '--name-only',
        '-r',
        this.config.to || HEAD,
        path || '.',
      ])
    )
      .split(EOL)
      .filter(line => line)
      .map(line => treatPathSep(line))
  }

  public async getFilesPath(path: string): Promise<string[]> {
    if (this.getFilesPathCache.has(path)) {
      return Array.from(this.getFilesPathCache.get(path)!)
    }

    const filesPath = await this.getFilesPathImpl(path)
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
        const currentPath = subPathSegments.join(PATH_SEP)
        if (!this.getFilesPathCache.has(currentPath)) {
          this.getFilesPathCache.set(currentPath, new Set())
        }
        this.getFilesPathCache.get(currentPath)!.add(filePath)
      }
    }

    // Store the full set of file paths for the given path in cache
    this.getFilesPathCache.set(path, new Set(filesPath))

    return filesPath
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

  public async getDiffLines(): Promise<string[]> {
    let lines: string[] = []
    for (const changeType of [ADDITION, MODIFICATION, DELETION]) {
      const linesOfType = await this.getDiffForType(changeType)
      lines = lines.concat(
        linesOfType.map(line =>
          line.replace(NUM_STAT_CHANGE_INFORMATION, `${changeType}${TAB}`)
        )
      )
    }
    return lines.map(treatPathSep)
  }

  protected async getDiffForType(changeType: string): Promise<string[]> {
    return (
      await this.simpleGit.raw([
        'diff',
        '--numstat',
        '--no-renames',
        ...(this.config.ignoreWhitespace ? IGNORE_WHITESPACE_PARAMS : []),
        `--diff-filter=${changeType}`,
        ...[this.config.from, this.config.to].filter(e => !!e),
        '--',
        this.config.source,
      ])
    ).split(EOL)
  }
}
