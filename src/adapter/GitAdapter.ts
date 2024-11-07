import { join } from 'path'

import { readFile } from 'fs-extra'
import { SimpleGit, simpleGit } from 'simple-git'

import { UTF8_ENCODING } from '../constant/fsConstants'
import {
  ADDITION,
  DELETION,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
} from '../constant/gitConstants'
import type { Config } from '../types/config'
import type { FileGitRef } from '../types/git'
import { TAB } from '../utils/cliConstants'
import { treatPathSep } from '../utils/fsUtils'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper'

const firstCommitParams = ['rev-list', '--max-parents=0', 'HEAD']
const BLOB_TYPE = 'blob'
const TREE_TYPE = 'tree'
const NUM_STAT_REGEX = /^\d+\t\d+\t/
const EOL = '\n'

const revPath = (pathDef: FileGitRef) =>
  `${pathDef.oid}:${treatPathSep(pathDef.path)}`

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

  private constructor(protected readonly config: Config) {
    this.simpleGit = simpleGit({ baseDir: config.repo, trimmed: true })
  }

  public async configureRepository() {
    await this.simpleGit.addConfig('core.quotepath', 'off')
  }

  public async parseRev(ref: string) {
    return await this.simpleGit.revparse([ref])
  }

  public async pathExists(path: string) {
    try {
      const type = await this.simpleGit.catFile([
        '-t',
        revPath({ path, oid: this.config.to }),
      ])
      return [TREE_TYPE, BLOB_TYPE].includes(type.trimEnd())
    } catch {
      return false
    }
  }

  public async getFirstCommitRef() {
    return await this.simpleGit.raw(firstCommitParams)
  }

  protected async getBufferContent(forRef: FileGitRef): Promise<Buffer> {
    const content = await this.getStringContent(forRef)
    return Buffer.from(content)
  }

  public async getStringContent(forRef: FileGitRef): Promise<string> {
    let content = await this.simpleGit.catFile([BLOB_TYPE, revPath(forRef)])

    if (isLFS(content)) {
      const lsfPath = getLFSObjectContentPath(content)
      const bufferData = await readFile(join(this.config.repo, lsfPath))
      content = bufferData?.toString(UTF8_ENCODING) ?? ''
    }

    return content
  }

  public async getFilesPath(path: string): Promise<string[]> {
    return (
      await this.simpleGit.raw([
        'ls-tree',
        '--name-only',
        '-r',
        this.config.to,
        treatPathSep(path),
      ])
    )
      .split(EOL)
      .filter(line => line)
  }

  public async getFilesFrom(path: string) {
    const filesPath = await this.getFilesPath(path)
    const bufferFiles: { path: string; content: Buffer }[] = []
    for (const filePath of filesPath) {
      const fileContent = await this.getBufferContent({
        path,
        oid: this.config.to,
      })
      bufferFiles.push({
        path: treatPathSep(filePath),
        content: fileContent,
      })
    }
    return bufferFiles
  }

  public async getDiffLines(): Promise<string[]> {
    const lines: string[] = []
    for (const changeType of [ADDITION, MODIFICATION, DELETION]) {
      const linesOfType = await this.getDiffForType(changeType)
      lines.push(
        ...linesOfType.map(statLine =>
          treatPathSep(statLine).replace(NUM_STAT_REGEX, `${changeType}${TAB}`)
        )
      )
    }
    return lines
  }

  protected async getDiffForType(changeType: string): Promise<string[]> {
    return (
      await this.simpleGit.raw([
        'diff',
        '--numstat',
        '--no-renames',
        ...(this.config.ignoreWhitespace ? IGNORE_WHITESPACE_PARAMS : []),
        `--diff-filter=${changeType}`,
        this.config.from,
        this.config.to,
        this.config.source,
      ])
    ).split(EOL)
  }
}
