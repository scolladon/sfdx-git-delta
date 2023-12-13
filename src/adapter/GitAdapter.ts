import git, { TREE, WalkerEntry } from 'isomorphic-git'
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
import { DOT, dirExists, fileExists } from '../utils/fsUtils'
import { join } from 'path'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper'

const firstCommitParams = ['rev-list', '--max-parents=0', 'HEAD']
const BLOB_TYPE = 'blob'
const TREE_TYPE = 'tree'

// Walk Optimisation:
// use custom iterate method to throttle and queue recursion using a Pool (using async module https://github.com/caolan/async)
// use global cache to avoid re-reading the same tree
// return tree instead of getting blob content

// TODO test with very diff and filelist with very big repository

const gitPathSeparatorNormalizer = (path: string) =>
  path.replace(/\\+/g, GIT_PATH_SEP)

const stripWhiteChar = (content: string) => content?.replace(/\s+/g, '')

export default class GitAdapter {
  private static instances: Map<Config, GitAdapter> = new Map()
  private static filesPathCache = {}

  public static getInstance(config: Config): GitAdapter {
    if (!GitAdapter.instances.has(config)) {
      const instance = new GitAdapter(config)
      GitAdapter.instances.set(config, instance)
    }

    return GitAdapter.instances.get(config)!
  }

  public static async isGit(dir: string): Promise<boolean> {
    const isGitDir = await dirExists(join(dir, GIT_FOLDER))
    const isGitFile = await fileExists(join(dir, GIT_FOLDER))

    return isGitDir || isGitFile
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
  protected readonly gitConfig
  protected readonly config: Config

  private constructor(config: Config) {
    this.config = config
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

  public async parseRev(ref: string) {
    const parsedRev = await this.isoGit.resolveRef({
      fs,
      dir: this.config.repo,
      ref,
    })
    return parsedRev
  }

  public async pathExists(path: string) {
    try {
      const { type } = await this.isoGit.readObject({
        fs,
        dir: this.config.repo,
        oid: this.config.to,
        filepath: path,
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

  public async getStringContent(filepath: string): Promise<string> {
    try {
      const { blob } = await this.isoGit.readBlob({
        ...this.gitConfig,
        oid: this.config.to,
        filepath: gitPathSeparatorNormalizer(filepath),
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

  public async getFilesPath(path: string = SOURCE_DEFAULT_VALUE) {
    const walker = filePathWalker(path)
    return await this.isoGit.walk({
      fs,
      dir: this.config.repo,
      cache: GitAdapter.filesPathCache,
      trees: [TREE({ ref: this.config.to })],
      map: walker,
    })
  }

  public async getFilesFrom(path: string) {
    const object = await this.isoGit.readObject({
      fs,
      dir: this.config.repo,
      oid: this.config.to,
      filepath: path,
    })
    // Return object exposing async getContent
    // Iterate over and output file using the getContent API when needed
    const blobFiles: { path: string; content: Uint8Array }[] = []
    if (object.type === TREE_TYPE) {
      const walker = contentWalker(path)
      blobFiles.push(
        ...(await this.isoGit.walk({
          fs,
          dir: this.config.repo,
          trees: [TREE({ ref: this.config.to })],
          map: walker,
        }))
      )
    } else if (object.type === BLOB_TYPE) {
      blobFiles.push({
        path,
        content: object.object as Uint8Array,
      })
    } else {
      throw new Error(`Path ${path} does not exist in ${this.config.to}`)
    }
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
    const walker = diffLineWalker(this.config.ignoreWhitespace)
    return this.isoGit.walk({
      fs,
      dir: this.config.repo,
      trees: [TREE({ ref: this.config.from }), TREE({ ref: this.config.to })],
      map: walker,
    })
  }
}

export const filePathWalker =
  (path: string) => async (filepath: string, trees: (WalkerEntry | null)[]) => {
    const [tree] = trees
    if (
      filepath === DOT ||
      (path !== SOURCE_DEFAULT_VALUE && !filepath.startsWith(path))
    ) {
      return
    }
    const treeType = await tree!.type()
    if (treeType !== BLOB_TYPE) {
      return
    }
    return gitPathSeparatorNormalizer(filepath)
  }

export const diffLineWalker =
  (ignoreWhitespace: boolean) =>
  async (path: string, trees: (WalkerEntry | null)[]) => {
    if (path === DOT) {
      return
    }

    for (const tree of trees.filter(Boolean)) {
      const type = await tree!.type()
      if (type !== BLOB_TYPE) {
        return
      }
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
      if (ignoreWhitespace) {
        const [fromContent, toContent] = await Promise.all(
          trees.map(async tree => {
            const content = (await tree!.content()) as Uint8Array
            return stripWhiteChar(Buffer.from(content).toString())
          })
        )
        if (fromContent === toContent) {
          return
        }
      }
      type = MODIFICATION
    }

    return `${type}\t${gitPathSeparatorNormalizer(path)}`
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
