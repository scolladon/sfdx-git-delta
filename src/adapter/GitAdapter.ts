/*
 * In-process git backend for sfdx-git-delta, backed by `@scolladon/tsgit`
 * (zero-dependency, no `git` binary, no subprocess). Object-store reads,
 * diffs, tree walks and blob content all go through the tsgit facade:
 *
 *   git rev-parse --verify <ref>^{commit} -> repo.revParse(ref) + peelToCommit
 *   git ls-tree --name-only -r <rev>    -> repo.primitives.flattenTree
 *   git cat-file --batch / blob         -> repo.primitives.readBlob / streamBlob
 *   git diff --name-status -M -w        -> repo.diff({ recursive,
 *                                            detectRenames, ignoreWhitespace })
 *   git archive --format=tar            -> tree walk + streamBlob, LFS
 *                                          pointers resolved (git archive +
 *                                          lfs smudge)
 *   git grep -l                         -> candidates: per-revision sorted
 *                                          path index (exact hit / binary-
 *                                          searched prefix range) on the
 *                                          literal surface, tree walk on
 *                                          the pattern surface; then
 *                                          readBlob + RegExp (grepBlobs,
 *                                          shared by grepUnderPaths and
 *                                          grepMatchingPathspecs)
 *   git merge-base <from> <to>          -> repo.primitives.mergeBase
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
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'

import {
  type Commit,
  type DiffChange,
  type ObjectId,
  openRepository,
  type Repository,
} from '@scolladon/tsgit'

import { UTF8_ENCODING } from '../constant/fsConstants.js'
import { EMPTY_TREE_OID } from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { getErrorMessage, NotACommitError } from '../utils/errorUtils.js'
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
  buildPathspecMatcher,
  buildScopeMatcher,
  hasRootScope,
  nonRootScopes,
  ROOT_PATHS,
  toDiffLines,
} from './pathMatching.js'
import { SortedPathIndex } from './sortedPathIndex.js'
import { TreeIndex } from './treeIndex.js'
import { mapTsgitError } from './tsgitErrorMap.js'

// walkTree yields directories and gitlinks too; only blob-bearing modes
// belong in the path -> blob id index (ls-tree -r parity).
const BLOB_MODES = new Set(['100644', '100755', '120000'])

type CandidateSelector = (
  blobIds: ReadonlyMap<string, ObjectId>,
  specs: string[]
) => Iterable<string>

function* keysMatching(
  blobIds: ReadonlyMap<string, ObjectId>,
  matches: (path: string) => boolean
): Generator<string> {
  for (const filePath of blobIds.keys()) {
    if (matches(filePath)) yield filePath
  }
}

// flattenRevision peels a revision to a commit, which the empty tree is not,
// so its index — by definition empty — is served without resolving it.
const EMPTY_BLOB_IDS: ReadonlyMap<string, ObjectId> = new Map()

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

// Streaming LFS-pointer detection for blobContentChunks (behind both
// streamContent and streamArchive): the literal magic
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
  // Takes the already-resolved (platform-form) path rather than resolving
  // again, so the key and the repository path it is derived from can never
  // drift onto two different resolutions of the same config.repo.
  private static keyFor(resolvedRepo: string): string {
    return sanitizePath(resolvedRepo)!
  }

  public static getInstance(config: Config): GitAdapter {
    // Resolved to an absolute path first: tsgit's openRepository validates
    // `cwd` eagerly and refuses anything relative outright, which sgd's own
    // CLI default ('./') would otherwise be. This platform-form value is
    // threaded straight through to repository reads (see getRepo and the
    // LFS reads below); the pool key instead takes its posix-sanitized
    // form, since sanitizePath's separator normalisation — safe for an
    // identity key — would corrupt a win32 UNC root if reads used it too.
    const resolvedRepo = resolve(config.repo)
    const key = GitAdapter.keyFor(resolvedRepo)
    if (!GitAdapter.instances.has(key)) {
      GitAdapter.instances.set(key, new GitAdapter(key, resolvedRepo))
    }
    return GitAdapter.instances.get(key)!
  }

  public static async closeAll(): Promise<void> {
    for (const instance of GitAdapter.instances.values()) {
      await instance.close()
    }
    GitAdapter.instances.clear()
  }

  // Per revision: the pending (or settled) build of repo-relative path ->
  // blob ObjectId. Stored as the promise, not the resolved map, and written
  // before the first await, so every caller that arrives while the first
  // walk is still running awaits that same walk instead of starting its own
  // (the DiffLineInterpreter queue and IOExecutor both fan out at
  // getConcurrencyThreshold(); buildRunTreeReader asks for `to` and `from`
  // under one Promise.all). Deterministic per revision and safe to share
  // across every run against this repository — unlike the tree index (see
  // buildTreeIndex), nothing here varies by caller-supplied scope. The map
  // is handed out read-only: one instance is shared by every caller, and two
  // consumers iterate it across an await.
  protected readonly blobIdIndex: Map<
    string,
    Promise<ReadonlyMap<string, ObjectId>>
  >
  // Keyed by the blob map's identity, so it inherits the revision key and
  // the evict-on-reject of `indexRevision` (a rejected build never produced
  // a map). Deterministic per map, so safe to share across pooled runs like
  // `blobIdIndex`.
  protected readonly sortedPathIndex: WeakMap<
    ReadonlyMap<string, ObjectId>,
    SortedPathIndex
  >
  private repoHandle: Promise<Repository> | null = null

  // `key` identifies the repository — the pool map key and every
  // user-facing message (mapTsgitError, the debug log below) render it, so
  // a repository that fails the same way twice always reads identically.
  // `repoPath` is the platform-native path actually opened and read from
  // (openRepository's cwd, the LFS reads) — never sanitized, since
  // sanitizePath's posix-only normalisation would corrupt a win32 UNC root.
  private constructor(
    private readonly key: string,
    private readonly repoPath: string
  ) {
    this.blobIdIndex = new Map<string, Promise<ReadonlyMap<string, ObjectId>>>()
    this.sortedPathIndex = new WeakMap()
  }

  // Read by ConfigValidator to render `error.PathIsNotGit` from the exact
  // same absolute value this adapter renders its own repository-refusal
  // messages from (see mapError below), so the two collapse to one sentence
  // through validateConfig's `new Set(errors)` dedupe instead of reporting
  // the same missing repository twice in different forms.
  public get repositoryKey(): string {
    return this.key
  }

  // Binds the repository argument every mapTsgitError call site needs so a
  // transposition between it and the adjacent `context: string` argument
  // can no longer compile — mapTsgitError itself stays a pure 3-argument
  // function for its own unit surface.
  private mapError(error: unknown, context: string): Error {
    return mapTsgitError(error, context, this.key)
  }

  protected getRepo(): Promise<Repository> {
    if (!this.repoHandle) {
      // sgd only ever reads a repository (revParse, diff, tree walks,
      // blobs) and never runs a verb that fires a hook or a merge driver,
      // so both execution surfaces are switched off outright. The
      // ownership gate is opted out of for the same reason: it would
      // refuse the container-mounted checkouts README.md documents as
      // supported, and tsgit cannot see the `safe.directory` those users
      // already configured for git itself.
      this.repoHandle = openRepository({
        cwd: this.repoPath,
        trust: 'always',
        hooks: false,
        command: false,
      })
    }
    return this.repoHandle
  }

  public async close(): Promise<void> {
    if (!this.repoHandle) return
    const handle = this.repoHandle
    // A failed open is cached like any other handle, so awaiting it here
    // would rethrow the raw engine error out of main.ts's finally and
    // replace the mapped error the caller already reported. There is
    // nothing to dispose when the open never produced a repository.
    this.repoHandle = null
    try {
      const repo = await handle
      await repo.dispose()
    } catch (error) {
      Logger.debug(
        lazy`GitAdapter.close: releasing '${this.key}' failed: ${() => getErrorMessage(error)}`
      )
    }
  }

  // Equivalent to `git rev-parse --verify <ref>^{commit}`: resolves the
  // revision and follows any tag chain down to the commit it names, so an
  // annotated tag is accepted while a tree-ish or blob (`HEAD^{tree}`,
  // `HEAD:path`, a bare tree oid, a tag pointing at a tree) is refused here
  // instead of being accepted and left to degrade every later read. Returns
  // the peeled COMMIT id, not the tag object's, so every consumer downstream
  // is handed a commit.
  @log
  public async resolveCommit(ref: string): Promise<string> {
    try {
      return (await this.peelRevision(ref)).id
    } catch (error) {
      throw this.mapError(error, ref)
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
      const matchesScope = buildScopeMatcher(scopes)
      for (const path of blobIds.keys()) {
        if (scopes.length === 0 || matchesScope(path)) {
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
  // Reached through peelRevision by resolveCommit as well, now that
  // validation peels every --from/--to up front — the typed error is what
  // lets ConfigValidator name the kind of object a revision resolved to
  // instead of just reporting a failure.
  protected async peelToCommit(oid: ObjectId, label: string): Promise<Commit> {
    const repo = await this.getRepo()
    let target = await repo.primitives.readObject(oid)
    while (target.type === 'tag') {
      target = await repo.primitives.readObject(target.data.object)
    }
    if (target.type !== 'commit') {
      throw new NotACommitError(label, target.type)
    }
    return target
  }

  // The shared resolve-then-peel invariant behind resolveCommit,
  // flattenRevision and getMergeBase. Centralizing it also pins the part
  // no test can catch: the label handed to peelToCommit must stay the
  // caller's revision string, never the oid revParse just returned, or the
  // error names a hash instead of what the user typed.
  private async peelRevision(revision: string): Promise<Commit> {
    const oid = await this.resolveSingleRevision(revision)
    return await this.peelToCommit(oid, revision)
  }

  // tsgit's revParse answers every line `git rev-parse` would print, so a
  // range, an exclusion or a working-tree path still resolves. sgd needs
  // `rev-parse --verify` semantics: exactly one included object.
  private async resolveSingleRevision(revision: string): Promise<ObjectId> {
    const repo = await this.getRepo()
    const entries = await repo.revParse(revision)
    const [entry] = entries
    if (entries.length !== 1 || entry?.kind !== 'object' || entry.negated) {
      throw new Error(`'${revision}' does not name a single revision`)
    }
    return entry.id
  }

  // Reads one blob of the root tree without flattening the whole revision:
  // callers such as the project descriptor lookup need a single file.
  @log
  public async getRootFileContent(
    revision: string,
    fileName: string
  ): Promise<string | undefined> {
    try {
      const repo = await this.getRepo()
      const commit = await this.peelRevision(revision)
      const { entries } = await repo.primitives.readTree(commit.data.tree)
      const entry = entries.find(
        ({ name, mode }) => name === fileName && BLOB_MODES.has(mode)
      )
      return entry ? await this.readBlobText(repo, entry.id) : undefined
    } catch (error) {
      throw this.mapError(error, revision)
    }
  }

  private async readBlobText(repo: Repository, id: ObjectId): Promise<string> {
    const { content } = await repo.primitives.readBlob(id)
    return Buffer.from(content).toString(UTF8_ENCODING)
  }

  // Shares the per-revision memo with buildTreeIndex, so a revision already
  // indexed for the run is a memo hit.
  @log
  public async getBlobIds(
    revision: string
  ): Promise<ReadonlyMap<string, ObjectId>> {
    try {
      return await this.indexRevision(revision)
    } catch (error) {
      throw this.mapError(error, revision)
    }
  }

  // Not `async` on purpose: an `await` between the memo read and the memo
  // write is what let concurrent callers each re-walk the tree, and a
  // non-async function cannot contain one.
  protected indexRevision(
    revision: string
  ): Promise<ReadonlyMap<string, ObjectId>> {
    const memoised = this.blobIdIndex.get(revision)
    if (memoised) {
      return memoised
    }
    const build = this.flattenRevision(revision).catch((error: unknown) => {
      // Evict so a later caller retries rather than inheriting the failure.
      // No identity check is needed: the slot holds this build until this
      // handler deletes it, so nothing can replace it first, and the
      // reaction cannot run before the synchronous set below, so the delete
      // never outruns the write.
      this.blobIdIndex.delete(revision)
      throw error
    })
    this.blobIdIndex.set(revision, build)
    return build
  }

  // Not `async` on purpose: the get and the set share one synchronous turn,
  // so concurrent callers resumed from the same `indexRevision` await never
  // sort the same map twice.
  private sortedPathsOf(
    blobIds: ReadonlyMap<string, ObjectId>
  ): SortedPathIndex {
    const memoised = this.sortedPathIndex.get(blobIds)
    if (memoised) {
      return memoised
    }
    const built = this.buildSortedPathIndex(blobIds)
    this.sortedPathIndex.set(blobIds, built)
    return built
  }

  // Protected only as the test seam that runs on a memo miss (same
  // precedent as flattenRevision below).
  protected buildSortedPathIndex(
    blobIds: ReadonlyMap<string, ObjectId>
  ): SortedPathIndex {
    return new SortedPathIndex(blobIds)
  }

  // flattenTree is the bulk traversal path (one call, no per-entry yields);
  // it takes a tree oid, so the commit is peeled first. Declared protected
  // to mark it as the test seam the integration memo guards spy: it is the
  // one call that runs only on a memo miss, and peelToCommit stopped being
  // that proxy once validation started peeling every --from/--to up front.
  protected async flattenRevision(
    revision: string
  ): Promise<ReadonlyMap<string, ObjectId>> {
    if (revision === EMPTY_TREE_OID) {
      return EMPTY_BLOB_IDS
    }
    const repo = await this.getRepo()
    const commit = await this.peelRevision(revision)
    const { entries } = await repo.primitives.flattenTree(commit.data.tree)
    const blobIds = new Map<string, ObjectId>()
    for (const [path, entry] of entries) {
      if (BLOB_MODES.has(entry.mode)) {
        blobIds.set(treatPathSep(path), entry.id)
      }
    }
    return blobIds
  }

  // Equivalent to `git merge-base <from> <to>`, resolved in-process via
  // tsgit — no local git binary needed. `from`/`to` are resolved through
  // revParse the same way indexRevision does, so this method is total over
  // any revision string (ref, short SHA, `HEAD~2`, …) rather than encoding
  // an "already an ObjectId" precondition in a comment. tsgit's `[]` result
  // (no common ancestor / unrelated histories) is a legitimate git answer,
  // not an exception — surfacing it as a user-facing error is the caller's
  // job (ConfigValidator), not this adapter's.
  @log
  public async getMergeBase(
    from: string,
    to: string
  ): Promise<string | undefined> {
    try {
      const repo = await this.getRepo()
      const [fromCommit, toCommit] = await Promise.all([
        this.peelRevision(from),
        this.peelRevision(to),
      ])
      // Criss-cross histories can legitimately have several common
      // ancestors; tsgit's mergeBase primitive returns all of them. Taking
      // only the first matches `git merge-base`'s own default (without
      // --all, which returns just one candidate), so this is a deliberate
      // choice, not an oversight.
      const [base] = await repo.primitives.mergeBase([
        fromCommit.id,
        toCommit.id,
      ])
      return base
    } catch (error) {
      throw this.mapError(error, `${from}...${to}`)
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
        content = await readFile(join(this.repoPath, lfsPath))
      }
      return content
    } catch (error) {
      throw this.mapError(error, forRef.oid)
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
      const lfsFile = join(this.repoPath, getLFSObjectContentPath(content))
      const { size } = await stat(lfsFile)
      if (size > SIZE_THRESHOLD) {
        throw new EscalateToStreamingSignal(size, forRef)
      }
      content = await readFile(lfsFile)
    }
    return content
  }

  // One lazy, pull-based generator wrapped by Readable.from: nothing is read
  // until the consumer reads, and backpressure comes from Readable.from's own
  // _read pulls. A blob starting with the LFS pointer magic is replaced by
  // the resolved local LFS object.
  public streamContent(forRef: FileGitRef): Readable {
    return toByteStream(this.resolvedContentChunks(forRef))
  }

  private async *resolvedContentChunks(
    forRef: FileGitRef
  ): AsyncGenerator<Uint8Array> {
    yield* this.blobContentChunks(await this.resolveObjectId(forRef))
  }

  private async *blobContentChunks(
    blobId: ObjectId
  ): AsyncGenerator<Uint8Array> {
    const repo = await this.getRepo()
    const chunks = normalizeChunks(await repo.primitives.streamBlob(blobId))
    // A consumer destroying the stream while paused on `yield head` never
    // reaches the `yield*` that would close the blob iterator for us.
    try {
      yield* this.resolvedBlobChunks(chunks)
    } finally {
      await chunks.return(undefined)
    }
  }

  private async *resolvedBlobChunks(
    chunks: AsyncGenerator<Uint8Array>
  ): AsyncGenerator<Uint8Array> {
    const head = await peekHead(chunks)
    if (isLfsPointer(head)) {
      yield* this.lfsObjectChunks(await accumulatePointer(chunks, head))
      return
    }
    yield head
    yield* chunks
  }

  private lfsObjectChunks(pointer: Buffer): AsyncIterable<Uint8Array> {
    return createReadStream(
      join(this.repoPath, getLFSObjectContentPath(pointer))
    )
  }

  public async *streamArchive(
    path: string,
    revision: string
  ): AsyncGenerator<{ path: string; stream: Readable }> {
    const blobIds = await this.indexRevision(revision)
    const inArchiveScope = buildScopeMatcher([path])
    for (const [filePath, blobId] of blobIds) {
      if (!inArchiveScope(filePath)) continue
      yield {
        path: filePath,
        stream: toByteStream(this.blobContentChunks(blobId)),
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

  // Concrete-path surface, resolved through the sorted path index: exact hit
  // or binary-searched directory range. `path` comes straight off the
  // repository (a git diff path run through treatPathSep, or
  // MetadataElement.basePath) and is
  // matched by literal directory prefix — never as a wildmatch pathspec, so
  // a metacharacter incidentally present in a real path (e.g. an object
  // folder named `Custom[1]__c`) can never be misread as a glob.
  @log
  public async grepUnderPaths(
    pattern: string,
    path: string | string[],
    revision: string
  ): Promise<string[]> {
    return this.grepBlobs(pattern, path, revision, (blobIds, specs) =>
      this.sortedPathsOf(blobIds).pathsFor(specs)
    )
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
    return this.grepBlobs(pattern, path, revision, (blobIds, specs) =>
      keysMatching(blobIds, buildPathspecMatcher(specs))
    )
  }

  private async grepBlobs(
    pattern: string,
    path: string | string[],
    revision: string,
    selectCandidates: CandidateSelector
  ): Promise<string[]> {
    try {
      const repo = await this.getRepo()
      const paths = Array.isArray(path) ? path : [path]
      const blobIds = await this.indexRevision(revision)
      return await this.readMatching(
        repo,
        new RegExp(pattern),
        blobIds,
        selectCandidates(blobIds, paths)
      )
    } catch (error) {
      Logger.debug(
        lazy`grepBlobs: grep for '${pattern}' in '${path}' at '${revision}' failed: ${() => getErrorMessage(error)}`
      )
      return []
    }
  }

  private async readMatching(
    repo: Repository,
    matcher: RegExp,
    blobIds: ReadonlyMap<string, ObjectId>,
    candidates: Iterable<string>
  ): Promise<string[]> {
    const matches: string[] = []
    for (const filePath of candidates) {
      const blob = await repo.primitives.readBlob(blobIds.get(filePath)!)
      if (matcher.test(Buffer.from(blob.content).toString(UTF8_ENCODING))) {
        matches.push(filePath)
      }
    }
    return matches
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
    // Stryker disable next-line ConditionalExpression,EqualityOperator -- equivalent: `.length` is never negative so `>= 0` is a tautology, and forcing this operand true only changes the ternary when unmatchable.length === 0 — in which case `unmatchable` is itself [], deep-equal to the `: []` branch it would take instead
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
      throw this.mapError(error, `${spec.from}..${spec.to}`)
    }
  }
}

// Normalizes streamBlob's result (a real BlobStream in production, plain
// arrays of chunks in unit fakes) into a single stateful AsyncGenerator so
// blobContentChunks can peek a few chunks via next() and later hand the same
// cursor to a yield* without losing its place.
async function* normalizeChunks(
  source: AsyncIterable<Uint8Array>
): AsyncGenerator<Uint8Array> {
  yield* source
}

// Surfaces any rejection as an Error so a stream consumer always gets one.
async function* asErrors(
  source: AsyncGenerator<Uint8Array>
): AsyncGenerator<Uint8Array> {
  try {
    yield* source
  } catch (error) {
    throw error instanceof Error ? error : new Error(getErrorMessage(error))
  }
}

const toByteStream = (source: AsyncGenerator<Uint8Array>): Readable =>
  Readable.from(asErrors(source), { objectMode: false })

const isLfsPointer = (head: Buffer): boolean =>
  // Stryker disable next-line ConditionalExpression -- equivalent: the length guard is redundant. Buffer#subarray clamps rather than throwing when the end index exceeds the buffer, and Buffer#equals is false for operands of differing length, so the comparison alone already returns false for any head shorter than the magic
  head.length >= LFS_MAGIC.length &&
  head.subarray(0, LFS_MAGIC.length).equals(LFS_MAGIC)

const peekHead = async (
  chunks: AsyncGenerator<Uint8Array>
): Promise<Buffer> => {
  const parts: Uint8Array[] = []
  let length = 0
  // Stryker disable next-line EqualityOperator -- equivalent: `<=` only shifts where the peek stops versus what the caller's remaining-chunk yield* / accumulatePointer picks up; the same total bytes reach the output either way, so the streamed output is byte-identical
  while (length < LFS_MAGIC.length) {
    const result = await chunks.next()
    if (result.done) break
    parts.push(result.value)
    length += result.value.length
  }
  return Buffer.concat(parts, length)
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
