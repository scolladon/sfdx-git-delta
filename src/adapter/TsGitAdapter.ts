/*
 * SPIKE: pure-TypeScript git backend for sfdx-git-delta.
 *
 * Drop-in replacement for GitAdapter's public surface backed by
 * `@scolladon/tsgit` (zero-dependency, no `git` binary, no subprocess).
 * Mapping of the subprocess surface onto tsgit:
 *
 *   git rev-parse --verify <ref>        -> repo.revParse(ref)
 *   git ls-tree --name-only -r <rev>    -> repo.primitives.walkTree (recursive)
 *   git rev-list --max-parents=0 HEAD   -> repo.primitives.walkCommits
 *   git cat-file --batch / blob         -> repo.primitives.readBlob
 *   git diff --name-status/-M/--numstat -> repo.diff({ format: 'tree' })
 *   git archive --format=tar            -> tree walk + readBlob streaming
 *   git grep -l                         -> tree walk + readBlob + RegExp
 *   git config core.*                   -> no-op (no subprocess output to fix)
 *
 * Known fidelity gaps (see spike findings):
 *   - ignoreWhitespace: tsgit's diff has no whitespace knobs; emulated by
 *     dropping modifications whose blobs are identical after stripping all
 *     whitespace (approximates --ignore-all-space --ignore-blank-lines).
 *   - gitGrep: pattern interpreted as a JS RegExp, not POSIX basic regex.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path/posix'
import { PassThrough, Readable } from 'node:stream'

import { openRepository, type Repository } from '@scolladon/tsgit'

import { TAB } from '../constant/cliConstants.js'
import { UTF8_ENCODING } from '../constant/fsConstants.js'
import {
  ADDITION,
  DELETION,
  HEAD,
  MODIFICATION,
  RENAMED,
} from '../constant/gitConstants.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'
import { pushAll } from '../utils/arrayUtils.js'
import { getErrorMessage } from '../utils/errorUtils.js'
import { treatPathSep } from '../utils/fsUtils.js'
import { getLFSObjectContentPath, isLFS } from '../utils/gitLfsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import type { GitBlobReader } from './gitBlobReader.js'
import { TreeIndex } from './treeIndex.js'

const ROOT_PATHS = new Set(['', '.', './'])
const ANY_WHITESPACE = /\s+/g
const RENAME_SCORE = 100
// walkTree yields directories and gitlinks too; only blob-bearing modes
// belong in the path -> blob id index (ls-tree -r parity).
const BLOB_MODES = new Set(['100644', '100755', '120000'])

// tsgit brands ObjectId but does not re-export the type from its Node entry
// point (nor PatchResult/TreeDiff); derive them from the facade so blob ids
// stay branded.
type BlobId = Awaited<ReturnType<Repository['revParse']>>

const DIRECTORY_MODE = '40000'
const GITLINK_MODE = '160000'

// File-level change synthesized from the recursive tree walk. tsgit's
// diffTrees is single-level (libgit2-style): directory entries surface as
// one change and the caller recurses, so paths here are already prefixed
// back to repo-relative form.
type FileChange =
  | { kind: typeof ADDITION; path: string; id: BlobId }
  | { kind: typeof DELETION; path: string; id: BlobId }
  | { kind: typeof MODIFICATION; path: string; oldId: BlobId; newId: BlobId }

export default class TsGitAdapter implements GitBlobReader {
  private static instances: Map<string, TsGitAdapter> = new Map()

  private static keyFor(config: Config): string {
    return `${config.repo}\0${config.to}`
  }

  public static getInstance(config: Config): TsGitAdapter {
    const key = TsGitAdapter.keyFor(config)
    if (!TsGitAdapter.instances.has(key)) {
      TsGitAdapter.instances.set(key, new TsGitAdapter(config))
    }
    return TsGitAdapter.instances.get(key)!
  }

  public static async closeAll(): Promise<void> {
    for (const instance of TsGitAdapter.instances.values()) {
      await instance.close()
    }
    TsGitAdapter.instances.clear()
  }

  protected readonly treeIndex: Map<string, TreeIndex>
  // Per revision: repo-relative path -> blob ObjectId. The tsgit counterpart
  // of `git cat-file --batch` oid:path resolution.
  protected readonly blobIdIndex: Map<string, Map<string, BlobId>>
  private repoHandle: Promise<Repository> | null = null

  private constructor(protected readonly config: Config) {
    this.treeIndex = new Map<string, TreeIndex>()
    this.blobIdIndex = new Map<string, Map<string, BlobId>>()
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
    const repo = await this.getRepo()
    return await repo.revParse(ref)
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

  // Walks the full tree at `revision` once and caches path -> blob oid.
  // Shared by the tree index, blob reads, archive streaming and grep.
  protected async indexRevision(
    revision: string
  ): Promise<Map<string, BlobId>> {
    const cached = this.blobIdIndex.get(revision)
    if (cached) {
      return cached
    }
    const repo = await this.getRepo()
    const commitId = await repo.revParse(revision)
    const tree = await repo.primitives.readTree(commitId)
    const blobIds = new Map<string, BlobId>()
    for await (const entry of repo.primitives.walkTree(tree, {
      recursive: true,
    })) {
      if (BLOB_MODES.has(entry.mode)) {
        blobIds.set(treatPathSep(entry.path), entry.id)
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
  }

  protected async resolveBlobId(forRef: FileGitRef): Promise<BlobId> {
    const blobIds = await this.indexRevision(forRef.oid)
    const blobId = blobIds.get(treatPathSep(forRef.path))
    if (!blobId) {
      throw new Error(`Path '${forRef.path}' not found at '${forRef.oid}'`)
    }
    return blobId
  }

  protected async readBlobBuffer(forRef: FileGitRef): Promise<Buffer> {
    const repo = await this.getRepo()
    const blobId = await this.resolveBlobId(forRef)
    const blob = await repo.primitives.readBlob(blobId)
    return Buffer.from(blob.content)
  }

  public async getBufferContent(forRef: FileGitRef): Promise<Buffer> {
    let content = await this.readBlobBuffer(forRef)
    if (isLFS(content)) {
      const lfsPath = getLFSObjectContentPath(content)
      content = await readFile(join(this.config.repo, lfsPath))
    }
    return content
  }

  // No subprocess in this backend: there is no cheaper streaming path to
  // escalate to, so the escalation contract degrades to a plain read.
  public async getBufferContentOrEscalate(forRef: FileGitRef): Promise<Buffer> {
    return await this.getBufferContent(forRef)
  }

  public streamContent(forRef: FileGitRef): Readable {
    const out = new PassThrough()
    this.getBufferContent(forRef)
      .then(content => {
        out.end(content)
      })
      .catch((error: unknown) => {
        out.destroy(
          error instanceof Error ? error : new Error(getErrorMessage(error))
        )
      })
    return out
  }

  public async *streamArchive(
    path: string,
    revision: string
  ): AsyncGenerator<{ path: string; stream: Readable }> {
    const repo = await this.getRepo()
    const blobIds = await this.indexRevision(revision)
    for (const [filePath, blobId] of blobIds) {
      if (!inScope(filePath, [path])) continue
      const blob = await repo.primitives.readBlob(blobId)
      yield { path: filePath, stream: Readable.from(Buffer.from(blob.content)) }
    }
  }

  @log
  public async getStringContent(forRef: FileGitRef): Promise<string> {
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

  @log
  public async gitGrep(
    pattern: string,
    path: string | string[],
    revision: string = this.config.to
  ): Promise<string[]> {
    try {
      const repo = await this.getRepo()
      const paths = Array.isArray(path) ? path : [path]
      const blobIds = await this.indexRevision(revision)
      const matcher = new RegExp(pattern)
      const matchesPathspec = buildPathspecMatcher(paths)
      const matches: string[] = []
      for (const [filePath, blobId] of blobIds) {
        if (!matchesPathspec(filePath)) continue
        const blob = await repo.primitives.readBlob(blobId)
        if (matcher.test(Buffer.from(blob.content).toString(UTF8_ENCODING))) {
          matches.push(filePath)
        }
      }
      return matches
    } catch (error) {
      Logger.debug(
        lazy`gitGrep: grep for '${pattern}' in '${path}' at '${revision}' failed: ${() => getErrorMessage(error)}`
      )
      return []
    }
  }

  @log
  public async *streamDiffLines(): AsyncGenerator<string> {
    const detectRenames = Boolean(this.config.changesManifest)
    const repo = await this.getRepo()
    const [fromTree, toTree] = await Promise.all([
      this.resolveTreeId(this.config.from),
      this.resolveTreeId(this.config.to),
    ])
    const scopes = this.config.source.filter(scope => !ROOT_PATHS.has(scope))
    const changes: FileChange[] = []
    for await (const change of this.walkDiff(repo, fromTree, toTree, '')) {
      if (scopes.length === 0 || inScope(change.path, scopes)) {
        changes.push(change)
      }
    }
    const { renames, rest } = detectRenames
      ? pairExactRenames(changes)
      : { renames: [], rest: changes }
    for (const [oldPath, newPath] of renames) {
      yield `${RENAMED}${RENAME_SCORE}${TAB}${treatPathSep(oldPath)}${TAB}${treatPathSep(newPath)}`
    }
    for (const change of rest) {
      const line = await this.toDiffLine(change)
      if (line) {
        yield line
      }
    }
  }

  protected async resolveTreeId(revision: string): Promise<BlobId> {
    const repo = await this.getRepo()
    const commitId = await repo.revParse(revision)
    const commit = await repo.primitives.readObject(commitId)
    if (commit.type !== 'commit') {
      throw new Error(`'${revision}' does not resolve to a commit`)
    }
    return commit.data.tree
  }

  // tsgit's diffTrees compares one tree level: a changed directory surfaces
  // as a single entry carrying the two sub-tree ids. Recurse into directory
  // entries and yield repo-relative file changes, mirroring
  // `git diff -r` semantics. Gitlinks are skipped (submodule pointer moves
  // are not deployable metadata). File-level type changes (symlink <-> file)
  // are dropped for parity with the subprocess `--diff-filter=AMD`.
  protected async *walkDiff(
    repo: Repository,
    oldTree: BlobId | undefined,
    newTree: BlobId | undefined,
    prefix: string
  ): AsyncGenerator<FileChange> {
    const { changes } = await repo.primitives.diffTrees(oldTree, newTree)
    for (const change of changes) {
      switch (change.type) {
        case 'add':
          yield* this.expandSide(
            repo,
            ADDITION,
            change.newMode,
            change.newId,
            joinPath(prefix, change.newPath)
          )
          break
        case 'delete':
          yield* this.expandSide(
            repo,
            DELETION,
            change.oldMode,
            change.oldId,
            joinPath(prefix, change.oldPath)
          )
          break
        case 'modify':
          yield* this.expandModify(repo, change, prefix)
          break
        case 'rename':
          // diffTrees is invoked without rename detection; renames are
          // re-derived globally by pairExactRenames. Defensive split.
          yield* this.expandSide(
            repo,
            DELETION,
            change.mode,
            change.id,
            joinPath(prefix, change.oldPath)
          )
          yield* this.expandSide(
            repo,
            ADDITION,
            change.mode,
            change.id,
            joinPath(prefix, change.newPath)
          )
          break
        case 'type-change':
          yield* this.expandTypeChange(repo, change, prefix)
          break
      }
    }
  }

  protected async *expandSide(
    repo: Repository,
    kind: typeof ADDITION | typeof DELETION,
    mode: string,
    id: BlobId,
    path: string
  ): AsyncGenerator<FileChange> {
    if (mode === GITLINK_MODE) return
    if (mode !== DIRECTORY_MODE) {
      yield kind === ADDITION
        ? { kind: ADDITION, path, id }
        : { kind: DELETION, path, id }
      return
    }
    const [oldTree, newTree] =
      kind === ADDITION ? [undefined, id] : [id, undefined]
    yield* this.walkDiff(repo, oldTree, newTree, path)
  }

  protected async *expandModify(
    repo: Repository,
    change: {
      oldMode: string
      newMode: string
      oldId: BlobId
      newId: BlobId
      path: string
    },
    prefix: string
  ): AsyncGenerator<FileChange> {
    const path = joinPath(prefix, change.path)
    if (change.oldMode === GITLINK_MODE || change.newMode === GITLINK_MODE) {
      return
    }
    const bothDirectories =
      change.oldMode === DIRECTORY_MODE && change.newMode === DIRECTORY_MODE
    if (bothDirectories) {
      yield* this.walkDiff(repo, change.oldId, change.newId, path)
      return
    }
    yield {
      kind: MODIFICATION,
      path,
      oldId: change.oldId,
      newId: change.newId,
    }
  }

  protected async *expandTypeChange(
    repo: Repository,
    change: {
      oldMode: string
      newMode: string
      oldId: BlobId
      newId: BlobId
      path: string
    },
    prefix: string
  ): AsyncGenerator<FileChange> {
    const path = joinPath(prefix, change.path)
    if (change.oldMode === DIRECTORY_MODE) {
      yield* this.expandSide(repo, DELETION, change.oldMode, change.oldId, path)
      yield* this.expandSide(repo, ADDITION, change.newMode, change.newId, path)
      return
    }
    if (change.newMode === DIRECTORY_MODE) {
      yield* this.expandSide(repo, DELETION, change.oldMode, change.oldId, path)
      yield* this.expandSide(repo, ADDITION, change.newMode, change.newId, path)
    }
    // file <-> symlink type changes are dropped (--diff-filter=AMD parity)
  }

  protected async toDiffLine(change: FileChange): Promise<string | null> {
    switch (change.kind) {
      case ADDITION:
        return `${ADDITION}${TAB}${treatPathSep(change.path)}`
      case DELETION:
        return `${DELETION}${TAB}${treatPathSep(change.path)}`
      case MODIFICATION: {
        if (
          this.config.ignoreWhitespace &&
          (await this.isWhitespaceOnlyChange(change.oldId, change.newId))
        ) {
          return null
        }
        return `${MODIFICATION}${TAB}${treatPathSep(change.path)}`
      }
    }
  }

  // Approximates `--ignore-all-space --ignore-blank-lines`: a modification
  // whose blobs are byte-identical once all whitespace is stripped carries
  // no deployable content change.
  protected async isWhitespaceOnlyChange(
    oldId: BlobId,
    newId: BlobId
  ): Promise<boolean> {
    const repo = await this.getRepo()
    const [oldBlob, newBlob] = await Promise.all([
      repo.primitives.readBlob(oldId),
      repo.primitives.readBlob(newId),
    ])
    const normalize = (content: Uint8Array) =>
      Buffer.from(content).toString(UTF8_ENCODING).replace(ANY_WHITESPACE, '')
    return normalize(oldBlob.content) === normalize(newBlob.content)
  }
}

const inScope = (path: string, scopes: string[]): boolean =>
  scopes.some(
    scope =>
      ROOT_PATHS.has(scope) || path === scope || path.startsWith(`${scope}/`)
  )

const joinPath = (prefix: string, name: string): string =>
  prefix ? `${prefix}/${name}` : name

const GLOB_CHARS = /[*?[]/
const REGEXP_SPECIALS = /[.+^${}()|\\\]]/g

// Git pathspec semantics: a literal pathspec matches by directory prefix; a
// pathspec containing wildcards uses wildmatch where `*` also crosses `/`
// (no `:(glob)` magic). Callers mix both shapes (e.g. flow translations use
// `<source>/*.translation-meta.xml`).
const buildPathspecMatcher = (specs: string[]): ((path: string) => boolean) => {
  // Git normalizes leading `./` (and the `.//*` shape produced by the
  // default `./` source dir) away before matching; repo paths never carry
  // either prefix.
  const normalized = specs.map(spec =>
    spec.replace(/^(\.\/)+/, '').replace(/^\/+/, '')
  )
  const literals = normalized.filter(spec => !GLOB_CHARS.test(spec))
  const globs = normalized
    .filter(spec => GLOB_CHARS.test(spec))
    .map(spec => {
      const escaped = spec
        .replace(REGEXP_SPECIALS, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      return new RegExp(`^${escaped}$`)
    })
  return (path: string): boolean =>
    (literals.length > 0 && inScope(path, literals)) ||
    globs.some(glob => glob.test(path))
}

// Exact-rename detection: pair an added and a deleted path carrying the
// same blob id (similarity 100%). Content-similarity renames (< 100%) are
// NOT detected — a known fidelity gap versus `git diff -M`.
const pairExactRenames = (
  changes: FileChange[]
): { renames: Array<[string, string]>; rest: FileChange[] } => {
  const deletesById = new Map<string, FileChange[]>()
  for (const change of changes) {
    if (change.kind === DELETION) {
      const queue = deletesById.get(change.id) ?? []
      queue.push(change)
      deletesById.set(change.id, queue)
    }
  }
  const renames: Array<[string, string]> = []
  const paired = new Set<FileChange>()
  for (const change of changes) {
    if (change.kind !== ADDITION) continue
    const queue = deletesById.get(change.id)
    const deleted = queue?.shift()
    if (deleted) {
      renames.push([deleted.path, change.path])
      paired.add(deleted)
      paired.add(change)
    }
  }
  return { renames, rest: changes.filter(change => !paired.has(change)) }
}
