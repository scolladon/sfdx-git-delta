'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'

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

  public has(path: string): boolean {
    return this.navigate(path)?.isFile === true
  }

  public hasPath(path: string): boolean {
    return this.navigate(path) !== undefined
  }

  public listChildren(dir: string): string[] {
    const node = this.navigate(dir)
    return node ? Array.from(node.children.keys()) : []
  }

  public getFilesUnder(dir: string): string[] {
    const node = this.navigate(dir)
    if (!node) return []
    const result: string[] = []
    this.collectFiles(node, dir, result)
    return result
  }

  public allPaths(): string[] {
    const result: string[] = []
    this.collectFiles(this.root, '', result)
    return result
  }

  public get size(): number {
    return this.fileCount
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
