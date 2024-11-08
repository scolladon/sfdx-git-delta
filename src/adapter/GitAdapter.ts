import { join } from 'path/posix'

import { readFile } from 'fs-extra'
import { SimpleGit, simpleGit } from 'simple-git'

import { UTF8_ENCODING } from '../constant/fsConstants'
import {
  ADDITION,
  BLOB_TYPE,
  DELETION,
  IGNORE_WHITESPACE_PARAMS,
  MODIFICATION,
  NUM_STAT_CHANGE_INFORMATION,
  TREE_TYPE,
} from '../constant/gitConstants'
import type { Config } from '../types/config'
import type { FileGitRef } from '../types/git'
import { TAB } from '../utils/cliConstants'
import { treatPathSep } from '../utils/fsUtils'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper'

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

  public async getFilesPath(path: string): Promise<string[]> {
    return (
      await this.simpleGit.raw([
        'ls-tree',
        '--name-only',
        '-r',
        this.config.to,
        path,
      ])
    )
      .split(EOL)
      .filter(line => line)
      .map(line => treatPathSep(line))
  }

  public async getFilesFrom(path: string) {
    const filesPath = await this.getFilesPath(path)
    const bufferFiles: { path: string; content: Buffer }[] = []
    for (const filePath of filesPath) {
      const fileContent = await this.getBufferContent({
        path: filePath,
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
        ...linesOfType.map(line =>
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
        this.config.from,
        this.config.to,
        this.config.source,
      ])
    ).split(EOL)
  }
}
