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
  type Commit,
  type DiffChange,
  type ObjectId,
  openRepository,
  type Repository,
} from '@scolladon/tsgit'

import { UTF8_ENCODING } from '../constant/fsConstants.js'
import { HEAD } from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { sanitizePath, treatPathSep } from '../utils/fsUtils.js'
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
// invocation) rather than by the cached GitAdapter singleton: the pool key
// is the repository alone, so any two concurrent sgd() calls against the
// same repo — regardless of their `to`, `from` or `source` — share one
// GitAdapter instance. Counters, or the scope list used to evaluate them,
// stored on `this` would let one caller's run bleed into another's result.
// Threading both the verdict and the scope list through as plain arguments
// sidesteps that entirely — each caller supplies its own on every call and
// nothing here ever reads or mutates shared state for either.
export type DiffScopeVerdict = { changesSeen: number; linesYielded: number }

// The diff request's git-facing parameters, owned by the caller (RepoGitDiff
// in production) rather than by GitAdapter — the adapter is bound to the
// repository, not to any one run's from/to/rename/whitespace choices.
export type DiffSpec = Readonly<{
  from: string
  to: string
  detectRenames: boolean
  ignoreWhitespace: boolean
}>

export type DiffRequest = Readonly<{
  spec: DiffSpec
  verdict: DiffScopeVerdict
  scopes: readonly Pathspec[]
}>

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

  // Normalises the pool key the same way ConfigValidator eventually
  // normalises config.repo (fsUtils#sanitizePath), so two configs that
  // differ only by an unnormalised repo path (e.g. `./repo` vs `repo`)
  // still resolve to one instance. ConfigValidator pools an adapter on the
  // raw config.repo before _sanitizeConfig runs, so without this a single
  // `--repo-dir ./repo` invocation would still allocate two instances.
  private static keyFor(config: Config): string {
    return sanitizePath(config.repo)!
  }

  public static getInstance(config: Config): GitAdapter {
    const key = GitAdapter.keyFor(config)
    if (!GitAdapter.instances.has(key)) {
      GitAdapter.instances.set(key, new GitAdapter(key))
    }
    return GitAdapter.instances.get(key)!
  }

  public static async closeAll(): Promise<void> {
    for (const instance of GitAdapter.instances.values()) {
      await instance.close()
    }
    GitAdapter.instances.clear()
  }

  // Per revision: repo-relative path -> blob ObjectId. The tsgit counterpart
  // of `git cat-file --batch` oid:path resolution. Deterministic per
  // revision and safe to share across every run against this repository —
  // unlike the tree index (see buildTreeIndex), nothing here varies by
  // caller-supplied scope.
  protected readonly blobIdIndex: Map<string, Map<string, ObjectId>>
  private repoHandle: Promise<Repository> | null = null

  private constructor(private readonly repo: string) {
    this.blobIdIndex = new Map<string, Map<string, ObjectId>>()
  }

  protected getRepo(): Promise<Repository> {
    if (!this.repoHandle) {
      this.repoHandle = openRepository({ cwd: this.repo })
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
  public async parseRev(ref: string): Promise<string> {
    try {
      const repo = await this.getRepo()
      return await repo.revParse(ref)
    } catch (error) {
      throw mapTsgitError(error, ref)
    }
  }

  // Builds and RETURNS a tree index for (revision, scopePaths) instead of
  // caching it: the caller (main.ts) owns the result and threads it to
  // every reader, so a builder/reader scope mismatch becomes structurally
  // impossible rather than a silently-missed cache key. On failure this
  // degrades exactly like the old preBuildTreeIndex did — debug-log and
  // return undefined, leaving the caller with no index for that revision
  // (readers treat "no index" as an empty read, never a throw).
  @log
  public async buildTreeIndex(
    revision: string,
    scopePaths: readonly string[]
  ): Promise<TreeIndex | undefined> {
    try {
      const blobIds = await this.indexRevision(revision)
      const index = new TreeIndex()
      const scopes = scopePaths.filter(path => !ROOT_PATHS.has(path))
      for (const path of blobIds.keys()) {
        if (scopes.length === 0 || inScope(path, scopes)) {
          index.add(path)
        }
      }
      return index
    } catch (error) {
      Logger.debug(
        lazy`buildTreeIndex: tree walk for '${revision}' failed: ${() => getErrorMessage(error)}`
      )
      return undefined
    }
  }

  // revParse returns the tag OBJECT oid for annotated tags (no auto-peel),
  // so follow the tag chain down to the tagged commit — matching
  // `git ls-tree -r <tag>` / `git merge-base` peeling semantics. `label`
  // identifies the original ref/oid for the error message (it can differ
  // from `oid` itself, e.g. a revision string vs. its resolved object id).
  protected async peelToCommit(oid: ObjectId, label: string): Promise<Commit> {
    const repo = await this.getRepo()
    let target = await repo.primitives.readObject(oid)
    while (target.type === 'tag') {
      target = await repo.primitives.readObject(target.data.object)
    }
    if (target.type !== 'commit') {
      throw new Error(`'${label}' does not resolve to a commit`)
    }
    return target
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
    const commit = await this.peelToCommit(revisionId, revision)
    const { entries } = await repo.primitives.flattenTree(commit.data.tree)
    const blobIds = new Map<string, ObjectId>()
    for (const [path, entry] of entries) {
      if (BLOB_MODES.has(entry.mode)) {
        blobIds.set(treatPathSep(path), entry.id)
      }
    }
    this.blobIdIndex.set(revision, blobIds)
    return blobIds
  }

  // Equivalent to `git merge-base <from> <to>`, resolved in-process via
  // tsgit — no local git binary needed. Both arguments must already be
  // resolved oids (the `as ObjectId` casts assert that precondition at the
  // trust boundary: ObjectId is a compile-time brand with no runtime
  // constructor, and callers only ever reach this method with SHAs already
  // round-tripped through parseRev). tsgit's `[]` result (no common
  // ancestor / unrelated histories) is a legitimate git answer, not an
  // exception — surfacing it as a user-facing error is the caller's job
  // (ConfigValidator), not this adapter's.
  @log
  public async getMergeBase(
    from: string,
    to: string
  ): Promise<string | undefined> {
    try {
      const repo = await this.getRepo()
      const [fromCommit, toCommit] = await Promise.all([
        this.peelToCommit(from as ObjectId, from),
        this.peelToCommit(to as ObjectId, to),
      ])
      const [base] = await repo.primitives.mergeBase([
        fromCommit.id,
        toCommit.id,
      ])
      return base
    } catch (error) {
      throw mapTsgitError(error, `${from}...${to}`)
    }
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
        content = await readFile(join(this.repo, lfsPath))
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
      const lfsFile = join(this.repo, getLFSObjectContentPath(content))
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
    createReadStream(join(this.repo, lfsPath))
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

  // Concrete-path surface: `path` comes straight off the repository (a git
  // diff path run through treatPathSep, or MetadataElement.basePath) and is
  // matched by literal directory prefix — never as a wildmatch pathspec, so
  // a metacharacter incidentally present in a real path (e.g. an object
  // folder named `Custom[1]__c`) can never be misread as a glob.
  @log
  public async grepUnderPaths(
    pattern: string,
    path: string | string[],
    revision: string
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
    revision: string
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
  public async *streamDiffLines(request: DiffRequest): AsyncGenerator<string> {
    const { spec, verdict, scopes } = request
    const { changes } = await this.requestDiff(spec)
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

  private async requestDiff(
    spec: DiffSpec
  ): Promise<{ changes: readonly DiffChange[] }> {
    try {
      const repo = await this.getRepo()
      return await repo.diff({
        from: spec.from,
        to: spec.to,
        recursive: true,
        detectRenames: spec.detectRenames,
        ...(spec.ignoreWhitespace ? IGNORE_WHITESPACE_OPTIONS : {}),
      })
    } catch (error) {
      throw mapTsgitError(error, `${spec.from}..${spec.to}`)
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
