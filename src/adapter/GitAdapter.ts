/*
 * In-process git backend for sfdx-git-delta, backed by `@scolladon/tsgit`
 * (zero-dependency, no `git` binary, no subprocess). Object-store reads,
 * diffs, tree walks and blob content all go through the tsgit facade:
 *
 *   git rev-parse --verify <ref>        -> repo.revParse(ref)
 *   git ls-tree --name-only -r <rev>    -> repo.primitives.flattenTree
 *   git rev-list --max-parents=0 HEAD   -> repo.primitives.walkCommits
 *   git cat-file --batch / blob         -> repo.primitives.readBlob / streamBlob
 *   git diff --name-status -M -w        -> repo.diff({ recursive,
 *                                            detectRenames, ignoreWhitespace })
 *   git archive --format=tar            -> tree walk + streamBlob
 *   git grep -l                         -> tree walk + readBlob + RegExp
 *                                          (grepBlobs, shared by
 *                                          grepUnderPaths and
 *                                          grepMatchingPathspecs)
 *   git config core.*                   -> no-op (nothing to configure)
 *
 * Fidelity note: grepBlobs matches content with JS RegExp semantics, not
 * POSIX basic regex. Callers are expected to pass metacharacter-free
 * literals so the two semantics agree; the known pattern set is pinned by
 * gitGrepPatternInventory.test.ts (new callers must extend that inventory).
 * A second fidelity axis follows from the path-matching split: path
 * matching is literal-prefix on grepUnderPaths' concrete-path surface and
 * wildmatch on grepMatchingPathspecs' pattern surface — only sgd-constructed
 * values, already validated to carry no wildcard metacharacters, reach the
 * latter.
 */
import { once } from 'node:events'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path/posix'
import { PassThrough, Readable } from 'node:stream'

import {
  type DiffChange,
  type ObjectId,
  openRepository,
  type Repository,
} from '@scolladon/tsgit'

import { UTF8_ENCODING } from '../constant/fsConstants.js'
import { HEAD } from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { pushAll } from '../utils/arrayUtils.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { treatPathSep } from '../utils/fsUtils.js'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import type { Pathspec } from '../utils/pathspec.js'
import {
  EscalateToStreamingSignal,
  type GitBlobReader,
  SIZE_THRESHOLD,
} from './gitBlobReader.js'
import {
  buildLiteralMatcher,
  buildPathspecMatcher,
  hasRootScope,
  inScope,
  nonRootScopes,
  ROOT_PATHS,
  toDiffLines,
} from './pathMatching.js'
import { TreeIndex } from './treeIndex.js'
import { mapTsgitError } from './tsgitErrorMap.js'

// walkTree yields directories and gitlinks too; only blob-bearing modes
// belong in the path -> blob id index (ls-tree -r parity).
const BLOB_MODES = new Set(['100644', '100755', '120000'])

// Owned by the caller (RepoGitDiff in production, one instance per sgd()
// invocation) rather than by the cached GitAdapter singleton: two
// concurrent sgd() calls that resolve to the same cache key (repo + to)
// share a GitAdapter instance, so counters — or the scope list used to
// evaluate them — stored on `this` would let one caller's config bleed
// into another's result (the cache key carries neither `source` nor
// `from`). Threading both the verdict and the scope list through as plain
// arguments sidesteps that entirely — each caller supplies its own on
// every call and nothing here ever reads or mutates shared state for
// either.
export type DiffScopeVerdict = { changesSeen: number; linesYielded: number }

// Maps sgd's whitespace-ignoring diff request onto tsgit's data-mode
// whitespace knobs: whitespace-only modifications drop out of the TreeDiff.
const IGNORE_WHITESPACE_OPTIONS = {
  ignoreWhitespace: 'all',
  ignoreBlankLines: true,
} as const

// Streaming LFS-pointer detection for streamContent: the literal magic
// prefix released LFS pointer files start with, and a generous upper
// bound on pointer body size (real pointers are ~130 bytes; this guards
// against a corrupt/oversized "pointer" masquerading as one).
const LFS_MAGIC = Buffer.from('version https://git-lfs.github.com/spec/v1\n')
const LFS_POINTER_CAP = 1024

export default class GitAdapter implements GitBlobReader {
  private static instances: Map<string, GitAdapter> = new Map()

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

  public static async closeAll(): Promise<void> {
    for (const instance of GitAdapter.instances.values()) {
      await instance.close()
    }
    GitAdapter.instances.clear()
  }

  protected readonly treeIndex: Map<string, TreeIndex>
  // Per revision: repo-relative path -> blob ObjectId. The tsgit counterpart
  // of `git cat-file --batch` oid:path resolution.
  protected readonly blobIdIndex: Map<string, Map<string, ObjectId>>
  private repoHandle: Promise<Repository> | null = null

  private constructor(protected readonly config: Config) {
    this.treeIndex = new Map<string, TreeIndex>()
    this.blobIdIndex = new Map<string, Map<string, ObjectId>>()
  }

  protected getRepo(): Promise<Repository> {
    if (!this.repoHandle) {
      this.repoHandle = openRepository({ cwd: this.config.repo })
    }
    return this.repoHandle
  }

  public async close(): Promise<void> {
    if (this.repoHandle) {
      const repo = await this.repoHandle
      await repo.dispose()
      this.repoHandle = null
    }
  }

  @log
  public async configureRepository(): Promise<void> {
    // core.longpaths / core.quotepath exist to fix `git` CLI output and
    // Windows path handling in subprocesses. tsgit reads the object store
    // directly: nothing to configure.
  }

  @log
  public async parseRev(ref: string): Promise<string> {
    try {
      const repo = await this.getRepo()
      return await repo.revParse(ref)
    } catch (error) {
      throw mapTsgitError(error, ref)
    }
  }

  // Equivalent to `git merge-base <to> <other>`, resolved in-process via
  // tsgit's mergeBase primitive — no local git binary needed.
  @log
  public async getMergeBase(to: string, other: string): Promise<string> {
    try {
      const repo = await this.getRepo()
      const [toId, otherId] = await Promise.all([
        repo.revParse(to),
        repo.revParse(other),
      ])
      const [base] = await repo.primitives.mergeBase([toId, otherId])
      if (!base) {
        throw new Error(`no merge base found between '${to}' and '${other}'`)
      }
      return base
    } catch (error) {
      throw mapTsgitError(error, `${to}...${other}`)
    }
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
      const blobIds = await this.indexRevision(revision)
      const index = new TreeIndex()
      const scopes = scopePaths.filter(scope => !ROOT_PATHS.has(scope))
      for (const path of blobIds.keys()) {
        if (scopes.length === 0 || inScope(path, scopes)) {
          index.add(path)
        }
      }
      this.treeIndex.set(revision, index)
    } catch (error) {
      Logger.debug(
        lazy`preBuildTreeIndex: tree walk for '${revision}' failed: ${() => getErrorMessage(error)}`
      )
    }
  }

  // Flattens the full tree at `revision` once and caches path -> blob oid.
  // Shared by the tree index, blob reads, archive streaming and grep.
  // flattenTree is the bulk traversal path (one call, no per-entry yields);
  // it takes a tree oid, so the commit is peeled first.
  protected async indexRevision(
    revision: string
  ): Promise<Map<string, ObjectId>> {
    const cached = this.blobIdIndex.get(revision)
    if (cached) {
      return cached
    }
    const repo = await this.getRepo()
    const revisionId = await repo.revParse(revision)
    // revParse returns the tag OBJECT oid for annotated tags (no auto-peel),
    // so follow the tag chain down to the tagged commit before reading its
    // tree — matching `git ls-tree -r <tag>` semantics.
    let target = await repo.primitives.readObject(revisionId)
    while (target.type === 'tag') {
      target = await repo.primitives.readObject(target.data.object)
    }
    if (target.type !== 'commit') {
      throw new Error(`'${revision}' does not resolve to a commit`)
    }
    const { entries } = await repo.primitives.flattenTree(target.data.tree)
    const blobIds = new Map<string, ObjectId>()
    for (const [path, entry] of entries) {
      if (BLOB_MODES.has(entry.mode)) {
        blobIds.set(treatPathSep(path), entry.id)
      }
    }
    this.blobIdIndex.set(revision, blobIds)
    return blobIds
  }

  protected pathExistsImpl(path: string, revision: string): boolean {
    const index = this.treeIndex.get(revision)
    if (!index) return false
    if (ROOT_PATHS.has(path)) return index.size > 0
    return index.hasPath(path)
  }

  @log
  public async pathExists(
    path: string,
    revision: string = this.config.to
  ): Promise<boolean> {
    return this.pathExistsImpl(path, revision)
  }

  @log
  public async getFirstCommitRef(): Promise<string> {
    try {
      const repo = await this.getRepo()
      const head = await repo.revParse(HEAD)
      let firstCommit = head
      for await (const commit of repo.primitives.walkCommits({
        from: [head],
      })) {
        if (commit.data.parents.length === 0) {
          firstCommit = commit.id
          break
        }
      }
      return firstCommit
    } catch (error) {
      throw mapTsgitError(error, HEAD)
    }
  }

  protected async resolveObjectId(forRef: FileGitRef): Promise<ObjectId> {
    const blobIds = await this.indexRevision(forRef.oid)
    const blobId = blobIds.get(treatPathSep(forRef.path))
    if (!blobId) {
      throw new Error(`Path '${forRef.path}' not found at '${forRef.oid}'`)
    }
    return blobId
  }

  protected async readBlobBuffer(forRef: FileGitRef): Promise<Buffer> {
    const repo = await this.getRepo()
    const blobId = await this.resolveObjectId(forRef)
    const blob = await repo.primitives.readBlob(blobId)
    return Buffer.from(blob.content)
  }

  public async getBufferContent(forRef: FileGitRef): Promise<Buffer> {
    try {
      let content = await this.readBlobBuffer(forRef)
      if (isLFS(content)) {
        const lfsPath = getLFSObjectContentPath(content)
        content = await readFile(join(this.config.repo, lfsPath))
      }
      return content
    } catch (error) {
      throw mapTsgitError(error, forRef.oid)
    }
  }

  // tsgit's Blob/BlobStream carry no size field, so the only way to know a
  // blob is oversized is to accumulate streamBlob chunks and watch the
  // running total: crossing SIZE_THRESHOLD escalates the caller onto the
  // dedicated streamContent path instead of materializing further.
  public async getBufferContentOrEscalate(forRef: FileGitRef): Promise<Buffer> {
    const repo = await this.getRepo()
    const blobId = await this.resolveObjectId(forRef)
    const blobStream = await repo.primitives.streamBlob(blobId)
    const parts: Uint8Array[] = []
    let length = 0
    for await (const chunk of blobStream) {
      parts.push(chunk)
      length += chunk.length
      if (length > SIZE_THRESHOLD) {
        throw new EscalateToStreamingSignal(length, forRef)
      }
    }
    let content = Buffer.concat(parts, length)
    if (isLFS(content)) {
      // The pointer itself is tiny, so the accumulated-length guard above
      // never fires for LFS-backed files — size the resolved object instead
      // and escalate oversized ones onto the streaming path.
      const lfsFile = join(this.config.repo, getLFSObjectContentPath(content))
      const { size } = await stat(lfsFile)
      if (size > SIZE_THRESHOLD) {
        throw new EscalateToStreamingSignal(size, forRef)
      }
      content = await readFile(lfsFile)
    }
    return content
  }

  // Peeks the first LFS_MAGIC.length bytes off the pull-based streamBlob
  // iterator: a match hands off to the resolved LFS object file, otherwise
  // the peeked head and every remaining chunk are forwarded as-is. Backed
  // by the async iterator's own pull semantics, so no pause/resume is
  // needed to respect backpressure — only out.write()'s own signal.
  public streamContent(forRef: FileGitRef): Readable {
    const out = new PassThrough()
    this.pipeBlobContent(forRef, out).catch((error: unknown) => {
      out.destroy(
        error instanceof Error ? error : new Error(getErrorMessage(error))
      )
    })
    return out
  }

  private async pipeBlobContent(
    forRef: FileGitRef,
    out: PassThrough
  ): Promise<void> {
    const repo = await this.getRepo()
    const blobId = await this.resolveObjectId(forRef)
    const blobStream = await repo.primitives.streamBlob(blobId)
    const chunks = normalizeChunks(blobStream)
    const { head, exhausted } = await peekHead(chunks)
    if (isLfsPointer(head)) {
      await this.pipeLfsObject(chunks, head, out)
      return
    }
    await forwardChunks(chunks, out, head, exhausted)
  }

  private async pipeLfsObject(
    chunks: AsyncGenerator<Uint8Array>,
    head: Buffer,
    out: PassThrough
  ): Promise<void> {
    const pointer = await accumulatePointer(chunks, head)
    const lfsPath = getLFSObjectContentPath(pointer)
    createReadStream(join(this.config.repo, lfsPath))
      .on('error', (error: Error) => out.destroy(error))
      .pipe(out)
  }

  public async *streamArchive(
    path: string,
    revision: string
  ): AsyncGenerator<{ path: string; stream: Readable }> {
    const repo = await this.getRepo()
    const blobIds = await this.indexRevision(revision)
    for (const [filePath, blobId] of blobIds) {
      if (!inScope(filePath, [path])) continue
      const blob = await repo.primitives.streamBlob(blobId)
      yield {
        path: filePath,
        stream: Readable.from(blob, { objectMode: false }),
      }
    }
  }

  @log
  public async getStringContent(forRef: FileGitRef): Promise<string> {
    // getBufferContent already maps raw tsgit errors — mapping exactly once
    // keeps the released error shapes intact (no double-wrapped messages).
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

  // Concrete-path surface: `path` comes straight off the repository (a git
  // diff path run through treatPathSep, or MetadataElement.basePath) and is
  // matched by literal directory prefix — never as a wildmatch pathspec, so
  // a metacharacter incidentally present in a real path (e.g. an object
  // folder named `Custom[1]__c`) can never be misread as a glob.
  @log
  public async grepUnderPaths(
    pattern: string,
    path: string | string[],
    revision: string = this.config.to
  ): Promise<string[]> {
    return this.grepBlobs(pattern, path, revision, buildLiteralMatcher)
  }

  // Pattern surface: `path` is an sgd-constructed pathspec (e.g.
  // `<source>/*.translation-meta.xml`) and is matched with git pathspec
  // wildmatch semantics (literal + glob).
  @log
  public async grepMatchingPathspecs(
    pattern: string,
    path: string | string[],
    revision: string = this.config.to
  ): Promise<string[]> {
    return this.grepBlobs(pattern, path, revision, buildPathspecMatcher)
  }

  private async grepBlobs(
    pattern: string,
    path: string | string[],
    revision: string,
    buildMatcher: (specs: string[]) => (candidate: string) => boolean
  ): Promise<string[]> {
    try {
      const repo = await this.getRepo()
      const paths = Array.isArray(path) ? path : [path]
      const blobIds = await this.indexRevision(revision)
      const matcher = new RegExp(pattern)
      const matchesPath = buildMatcher(paths)
      const matches: string[] = []
      for (const [filePath, blobId] of blobIds) {
        if (!matchesPath(filePath)) continue
        const blob = await repo.primitives.readBlob(blobId)
        if (matcher.test(Buffer.from(blob.content).toString(UTF8_ENCODING))) {
          matches.push(filePath)
        }
      }
      return matches
    } catch (error) {
      Logger.debug(
        lazy`grepBlobs: grep for '${pattern}' in '${path}' at '${revision}' failed: ${() => getErrorMessage(error)}`
      )
      return []
    }
  }

  // One facade diff call carries the whole subprocess contract: `recursive`
  // is `git diff -r`, `detectRenames` is `-M` (similarity-based, gated
  // behind `config.changesManifest` like the subprocess `-M`), and the
  // whitespace options drop whitespace-only modifications the way the
  // subprocess numstat path does.
  @log
  public async *streamDiffLines(
    verdict: DiffScopeVerdict,
    scopes: readonly Pathspec[]
  ): AsyncGenerator<string> {
    const { changes } = await this.requestDiff()
    // git unions pathspecs (`-- . src` matches everything), so a root scope
    // must not be filtered out here even when non-root scopes are also
    // configured — the full, unfiltered source list is what `inScope`
    // (via toDiffLines) expects to reproduce that union.
    for (const change of changes) {
      verdict.changesSeen++
      for (const line of toDiffLines(change, scopes)) {
        verdict.linesYielded++
        yield line
      }
    }
  }

  // Every non-root scope matched nothing in the drained diff. A path can
  // match several scopes, so this is all-or-nothing rather than per-scope
  // — per-scope attribution needs bookkeeping that buys nothing. A root
  // scope alongside non-root ones still means "everything is in scope"
  // (union), so naming the non-root scopes as unmatched would be
  // misleading — suppress the verdict entirely when one is present.
  public getUnmatchedSourceScopes(
    verdict: DiffScopeVerdict,
    scopes: readonly Pathspec[]
  ): readonly string[] {
    if (hasRootScope(scopes)) return []
    const unmatchable = nonRootScopes(scopes)
    return unmatchable.length > 0 &&
      verdict.changesSeen > 0 &&
      verdict.linesYielded === 0
      ? unmatchable
      : []
  }

  private async requestDiff(): Promise<{ changes: readonly DiffChange[] }> {
    try {
      const repo = await this.getRepo()
      return await repo.diff({
        from: this.config.from,
        to: this.config.to,
        recursive: true,
        detectRenames: Boolean(this.config.changesManifest),
        ...(this.config.ignoreWhitespace ? IGNORE_WHITESPACE_OPTIONS : {}),
      })
    } catch (error) {
      throw mapTsgitError(error, `${this.config.from}..${this.config.to}`)
    }
  }
}

// Normalizes streamBlob's result (a real BlobStream in production, plain
// arrays of chunks in unit fakes) into a single stateful AsyncGenerator so
// streamContent can peek a few chunks via next() and later hand the same
// cursor to a for-await loop without losing its place.
async function* normalizeChunks(
  source: AsyncIterable<Uint8Array>
): AsyncGenerator<Uint8Array> {
  yield* source
}

const isLfsPointer = (head: Buffer): boolean =>
  head.length >= LFS_MAGIC.length &&
  head.subarray(0, LFS_MAGIC.length).equals(LFS_MAGIC)

const peekHead = async (
  chunks: AsyncGenerator<Uint8Array>
): Promise<{ head: Buffer; exhausted: boolean }> => {
  const parts: Uint8Array[] = []
  let length = 0
  while (length < LFS_MAGIC.length) {
    const result = await chunks.next()
    if (result.done) {
      return { head: Buffer.concat(parts, length), exhausted: true }
    }
    parts.push(result.value)
    length += result.value.length
  }
  return { head: Buffer.concat(parts, length), exhausted: false }
}

const writeChunk = async (
  out: PassThrough,
  chunk: Uint8Array
): Promise<void> => {
  if (!out.write(chunk)) {
    await once(out, 'drain')
  }
}

const forwardChunks = async (
  chunks: AsyncGenerator<Uint8Array>,
  out: PassThrough,
  head: Buffer,
  exhausted: boolean
): Promise<void> => {
  if (head.length > 0) {
    await writeChunk(out, head)
  }
  if (!exhausted) {
    for await (const chunk of chunks) {
      await writeChunk(out, chunk)
    }
  }
  out.end()
}

const assertWithinPointerCap = (length: number): void => {
  if (length > LFS_POINTER_CAP) {
    throw new Error('LFS pointer exceeds expected size')
  }
}

const accumulatePointer = async (
  chunks: AsyncGenerator<Uint8Array>,
  head: Buffer
): Promise<Buffer> => {
  const parts: Uint8Array[] = [head]
  let length = head.length
  assertWithinPointerCap(length)
  for await (const chunk of chunks) {
    parts.push(chunk)
    length += chunk.length
    assertWithinPointerCap(length)
  }
  return Buffer.concat(parts, length)
}
