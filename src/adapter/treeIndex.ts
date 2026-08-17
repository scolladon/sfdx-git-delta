'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import { pushAll } from '../utils/arrayUtils.js'
import { ROOT_PATHS } from './pathMatching.js'

type TrieNode = {
  children: Map<string, TrieNode>
  isFile: boolean
}

const createNode = (): TrieNode => ({
  children: new Map(),
  isFile: false,
})

export class TreeIndex {
  protected readonly root: TrieNode = createNode()
  protected fileCount: number = 0

  public add(path: string): void {
    const parts = path.split(PATH_SEP)
    let node = this.root
    for (const part of parts) {
      let child = node.children.get(part)
      if (!child) {
        child = createNode()
        node.children.set(part, child)
      }
      node = child
    }
    if (!node.isFile) {
      node.isFile = true
      this.fileCount++
    }
  }

  // Not part of the public surface: the ROOT_PATHS-aware pathExists/
  // getFilesPath wrappers below are every caller's actual entry point.
  // Keeping these raw lookups protected stops a future caller from
  // bypassing the ROOT_PATHS branch those wrappers exist for.
  protected has(path: string): boolean {
    return this.navigate(path)?.isFile === true
  }

  protected hasPath(path: string): boolean {
    return this.navigate(path) !== undefined
  }

  public listChildren(dir: string): string[] {
    const node = this.navigate(dir)
    return node ? Array.from(node.children.keys()) : []
  }

  protected getFilesUnder(dir: string): string[] {
    const node = this.navigate(dir)
    if (!node) return []
    const result: string[] = []
    this.collectFiles(node, dir, result)
    return result
  }

  protected allPaths(): string[] {
    const result: string[] = []
    this.collectFiles(this.root, '', result)
    return result
  }

  // Stays public (unlike has/hasPath/getFilesUnder/allPaths above): no
  // ROOT_PATHS-aware wrapper exposes the exact indexed-file count —
  // pathExists/getFilesPath only answer boolean/list questions — so this
  // is the sole way to pin the add() idempotency guarantee (the same path
  // added twice must not double-count).
  public get size(): number {
    return this.fileCount
  }

  // The two ROOT_PATHS-aware lookups every caller used to ask GitAdapter
  // for (pathExistsImpl, getFilesPathCached) — now answered by the index
  // itself instead of a scope-keyed cache lookup.
  public pathExists(path: string): boolean {
    if (ROOT_PATHS.has(path)) return this.size > 0
    return this.hasPath(path)
  }

  public getFilesPath(paths: string | string[]): string[] {
    const list = Array.isArray(paths) ? paths : [paths]
    const result: string[] = []
    for (const path of list) {
      pushAll(result, this.getFilesPathFor(path))
    }
    return result
  }

  private getFilesPathFor(path: string): string[] {
    if (ROOT_PATHS.has(path)) return this.allPaths()
    if (this.has(path)) return [path]
    return this.getFilesUnder(path)
  }

  protected navigate(path: string): TrieNode | undefined {
    if (!path) return this.root
    const parts = path.split(PATH_SEP)
    let node: TrieNode | undefined = this.root
    for (const part of parts) {
      node = node.children.get(part)
      if (!node) return undefined
    }
    return node
  }

  // Recursion depth is bounded by path segment count, not file count.
  // Worst case under OS PATH_MAX (~4096 bytes) is well under V8's stack limit.
  protected collectFiles(node: TrieNode, prefix: string, out: string[]): void {
    if (node.isFile) out.push(prefix)
    for (const [segment, child] of node.children) {
      const childPath = prefix ? `${prefix}${PATH_SEP}${segment}` : segment
      this.collectFiles(child, childPath, out)
    }
  }
}
