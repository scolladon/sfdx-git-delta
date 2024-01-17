import git, { TREE, WalkerEntry, WalkerIterateCallback } from 'isomorphic-git'
import { simpleGit, SimpleGit } from 'simple-git'
import { readFile } from 'fs-extra'
import fs from 'fs'
import { Config } from '../types/config'
import {
  UTF8_ENCODING,
  GIT_FOLDER,
  GIT_PATH_SEP,
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../constant/gitConstants'
import { SOURCE_DEFAULT_VALUE } from '../utils/cliConstants'
import { dirExists, fileExists } from '../utils/fsUtils'
import { DOT } from '../constant/fsConstants'
import { join, sep } from 'path'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper'
import { FileGitRef } from '../types/git'

const firstCommitParams = ['rev-list', '--max-parents=0', 'HEAD']
const BLOB_TYPE = 'blob'
const TREE_TYPE = 'tree'

const gitPathSeparatorNormalizer = (path: string) =>
  path.replace(/\\+/g, GIT_PATH_SEP)

const stripWhiteChar = (content: string) => content?.replace(/\s+/g, '')

export const iterate = async (
  walk: WalkerIterateCallback,
  children: IterableIterator<Array<WalkerEntry>>
) => {
  const result = []
  for (const child of children) {
    const walkedChildResult = await walk(child)
    result.push(walkedChildResult)
  }
  return result
}

type GitBaseConfig = {
  fs: typeof fs
  dir: string
  gitdir?: string
}

export default class GitAdapter {
  private static instances: Map<Config, GitAdapter> = new Map()
  private static sharedCache = {}

  public static getInstance(config: Config): GitAdapter {
    if (!GitAdapter.instances.has(config)) {
      const instance = new GitAdapter(config)
      GitAdapter.instances.set(config, instance)
    }

    return GitAdapter.instances.get(config)!
  }

  private async getBufferFromBlob(blob: Uint8Array): Promise<Buffer> {
    let bufferData: Buffer = Buffer.from(blob)
    if (isLFS(bufferData)) {
      const lsfPath = getLFSObjectContentPath(bufferData)
      bufferData = await readFile(join(this.config.repo, lsfPath))
    }

    return bufferData
  }

  protected readonly isoGit = git
  protected readonly simpleGit: SimpleGit
  protected readonly gitConfig: GitBaseConfig

  private constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly config: Config
  ) {
    this.simpleGit = simpleGit(config.repo)
    this.gitConfig = {
      fs: fs,
      dir: config.repo,
    }
  }

  public async configureRepository() {
    const quotepathOff = {
      path: 'core.quotepath',
      value: 'off',
    }
    await this.isoGit.setConfig({
      ...this.gitConfig,
      ...quotepathOff,
    })
  }

  public async setGitDir(): Promise<void> {
    if (this.gitConfig.gitdir) {
      return
    }
    if (await dirExists(join(this.config.repo, GIT_FOLDER))) {
      this.gitConfig.gitdir = join(this.config.repo, GIT_FOLDER)
    } else if (await fileExists(join(this.config.repo, GIT_FOLDER))) {
      const gitFileContent = await readFile(join(this.config.repo, GIT_FOLDER))
      this.gitConfig.gitdir = gitFileContent.toString().trim().substring(8)
    } else {
      throw new Error('Not a git repository')
    }
  }

  public async parseRev(ref: string) {
    const parsedRev = await this.isoGit.resolveRef({
      ...this.gitConfig,
      ref,
    })
    return parsedRev
  }

  public async pathExists(path: string) {
    try {
      const { type } = await this.isoGit.readObject({
        ...this.gitConfig,
        oid: this.config.to,
        filepath: path,
        cache: GitAdapter.sharedCache,
      })
      return [TREE_TYPE, BLOB_TYPE].includes(type)
    } catch {
      return false
    }
  }

  public async getFirstCommitRef() {
    const sha = await this.simpleGit.raw(firstCommitParams)
    return sha
  }

  public async getStringContent(forRef: FileGitRef): Promise<string> {
    try {
      const { blob } = await this.isoGit.readBlob({
        ...this.gitConfig,
        oid: forRef.oid,
        filepath: gitPathSeparatorNormalizer(forRef.path),
        cache: GitAdapter.sharedCache,
      })
      const bufferData = await this.getBufferFromBlob(blob)
      return bufferData?.toString(UTF8_ENCODING) ?? ''
    } catch (error) {
      const err = error as Error
      if (err.name === 'NotFoundError') {
        return ''
      } else {
        throw error
      }
    }
  }

  public async getFilesPath(path: string) {
    const walker = filePathWalker(path)
    return await this.isoGit.walk({
      ...this.gitConfig,
      cache: GitAdapter.sharedCache,
      trees: [TREE({ ref: this.config.to })],
      map: walker,
      iterate,
    })
  }

  public async getFilesFrom(path: string) {
    const object = await this.isoGit.readObject({
      ...this.gitConfig,
      oid: this.config.to,
      filepath: path,
      cache: GitAdapter.sharedCache,
    })
    // Return object exposing async getContent
    // Iterate over and output file using the getContent API when needed
    const blobFiles: { path: string; content: Uint8Array }[] = []
    if (object.type === TREE_TYPE) {
      const filesContent = await this.isoGit.walk({
        ...this.gitConfig,
        cache: GitAdapter.sharedCache,
        trees: [TREE({ ref: this.config.to })],
        map: contentWalker(path),
        iterate,
      })
      blobFiles.push(...filesContent)
    } else if (object.type === BLOB_TYPE) {
      blobFiles.push({
        path,
        content: object.object as Uint8Array,
      })
    } else {
      throw new Error(`Path ${path} does not exist in ${this.config.to}`)
    }
    return await this.getContentFromFiles(blobFiles)
  }

  protected async getContentFromFiles(
    blobFiles: { path: string; content: Uint8Array }[]
  ) {
    const bufferFiles: { path: string; content: Buffer }[] = []
    for (const file of blobFiles) {
      const content = await this.getBufferFromBlob(file.content)
      bufferFiles.push({
        path: gitPathSeparatorNormalizer(file.path),
        content,
      })
    }
    return bufferFiles
  }

  public async getDiffLines() {
    const walker = diffLineWalker(this.config)
    return this.isoGit.walk({
      ...this.gitConfig,
      cache: GitAdapter.sharedCache,
      trees: [TREE({ ref: this.config.from }), TREE({ ref: this.config.to })],
      map: walker,
      iterate,
    })
  }
}

export const filePathWalker = (path: string) => {
  const doesNotStartsWithPath = pathDoesNotStartsWith(path)
  return async (filepath: string, trees: (WalkerEntry | null)[]) => {
    const [tree] = trees
    let normalizedPath
    if (
      filepath !== DOT &&
      !doesNotStartsWithPath(filepath) &&
      (await tree!.type()) === BLOB_TYPE
    ) {
      normalizedPath = gitPathSeparatorNormalizer(filepath)
    }
    return normalizedPath
  }
}

export const diffLineWalker = (config: Config) => {
  const doesNotStartsWithSource = pathDoesNotStartsWith(config.source)
  return async (path: string, trees: (WalkerEntry | null)[]) => {
    if (path === DOT || doesNotStartsWithSource(path)) {
      return
    }

    const types = await Promise.all(
      trees.filter(Boolean).map(tree => tree!.type())
    )
    if (types.some(type => type !== BLOB_TYPE)) {
      return
    }

    const [fromOID, toOID] = await Promise.all(trees.map(tree => tree?.oid()))
    if (fromOID === toOID) {
      return
    }
    let type
    if (fromOID === undefined) {
      type = ADDITION
    } else if (toOID === undefined) {
      type = DELETION
    } else {
      if (
        config.ignoreWhitespace &&
        (await isContentsEqualIgnoringWhiteChars(trees))
      ) {
        return
      }
      type = MODIFICATION
    }

    return `${type}\t${gitPathSeparatorNormalizer(path)}`
  }
}

const pathDoesNotStartsWith = (root: string) => {
  const gitFormattedRoot = root.split(sep).join(GIT_PATH_SEP) + GIT_PATH_SEP
  return (path: string) =>
    root !== SOURCE_DEFAULT_VALUE && !path.startsWith(gitFormattedRoot)
}

const isContentsEqualIgnoringWhiteChars = async (
  trees: (WalkerEntry | null)[]
) => {
  const [fromContent, toContent] = await Promise.all(
    trees.map(async tree => {
      const content = (await tree!.content()) as Uint8Array
      return stripWhiteChar(Buffer.from(content).toString())
    })
  )
  return fromContent === toContent
}

export const contentWalker =
  (path: string) => async (filepath: string, trees: (WalkerEntry | null)[]) => {
    const [tree] = trees
    if (filepath === DOT || !filepath.startsWith(path)) {
      return
    }
    const treeType = await tree!.type()
    if (treeType !== BLOB_TYPE) {
      return
    }

    const blob: Uint8Array = (await tree!.content()) as Uint8Array
    return {
      path: gitPathSeparatorNormalizer(filepath),
      content: blob,
    }
  }
