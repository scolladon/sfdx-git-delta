'use strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runGit, runGitText } from './gitTestHarness'

export type RepoFormat = {
  // The name that appears in vitest output, so a reduced run names itself.
  readonly name: string
  readonly refFormat: 'files' | 'reftable'
  readonly objectFormat: 'sha1' | 'sha256'
}

export const FILES_SHA1: RepoFormat = {
  name: 'files/sha1',
  refFormat: 'files',
  objectFormat: 'sha1',
}
export const REFTABLE_SHA1: RepoFormat = {
  name: 'reftable/sha1',
  refFormat: 'reftable',
  objectFormat: 'sha1',
}
export const FILES_SHA256: RepoFormat = {
  name: 'files/sha256',
  refFormat: 'files',
  objectFormat: 'sha256',
}

/**
 * `dir` is already an empty directory. Only non-default dimensions are
 * named on the command line: `--ref-format` landed in git 2.45, so passing
 * it unconditionally would fail the baseline fixture — and the capability
 * probe below, which reuses this function — on an older runner for no
 * reason. Callers that pass no format get the exact invocation this file
 * has always used.
 */
export const initRepo = (
  dir: string,
  format: RepoFormat = FILES_SHA1
): void => {
  const args = ['init', '--quiet']
  if (format.refFormat !== FILES_SHA1.refFormat) {
    args.push(`--ref-format=${format.refFormat}`)
  }
  if (format.objectFormat !== FILES_SHA1.objectFormat) {
    args.push(`--object-format=${format.objectFormat}`)
  }
  runGit(args, { cwd: dir })
}

/**
 * Builds a throwaway repository in a fresh temp directory to answer "does
 * this runner's git binary support this ref/object format combination".
 * The verdict is the handled outcome: an older git rejects an unknown
 * `--ref-format`/`--object-format` value with a non-zero exit, which
 * `execFileSync` surfaces as a thrown error, caught here and turned into
 * `false` rather than failing the whole test file.
 */
export const isRepoFormatSupported = (format: RepoFormat): boolean => {
  const probeDir = mkdtempSync(join(tmpdir(), 'sgd-format-probe-'))
  try {
    initRepo(probeDir, format)
    return true
  } catch {
    return false
  } finally {
    rmSync(probeDir, { recursive: true, force: true })
  }
}

export type FixtureRefs = {
  // The very first commit — no parents.
  root: string
  // Baseline snapshot for the plain/whitespace diff scenarios.
  diffFrom: string
  // A/M(real)/M(whitespace-only)/D changes landed since `diffFrom`.
  diffTo: string
  // One commit past `diffTo`: a pure rename, content preserved.
  renameTo: string
  // HEAD — the last commit in the fixture.
  head: string
}

export const GREP_MARKER = 'PARITY_MARKER_TOKEN'
export const WHITESPACE_ONLY_PATH = 'src/index.txt'
export const RENAME_FROM_PATH = 'src/lib/nested/deep.txt'
export const RENAME_TO_PATH = 'src/lib/nested/renamed.txt'
export const ARCHIVE_SCOPE = 'src'
export const EXECUTABLE_PATH = 'scripts/run.sh'
export const SYMLINK_PATH = 'assets/link-to-index'
export const PREFIX_COLLISION_PATH = 'src-legacy/note.txt'
export const REGISTRY_RECOGNISED_PATH = 'src/lib/FixtureClass.cls'

type FileMode = '100644' | '100755' | '120000'

type AddFile = { kind: 'add'; mode: FileMode; path: string; content: string }
type DeleteFile = { kind: 'delete'; path: string }
type RenameFile = { kind: 'rename'; from: string; to: string }
type FixtureOp = AddFile | DeleteFile | RenameFile

const hashBlob = (dir: string, content: string): string =>
  runGitText(['hash-object', '-w', '--stdin'], {
    cwd: dir,
    input: Buffer.from(content),
  })

const applyOp = (dir: string, op: FixtureOp): void => {
  if (op.kind === 'add') {
    const blobOid = hashBlob(dir, op.content)
    runGit(
      [
        'update-index',
        '--add',
        '--cacheinfo',
        `${op.mode},${blobOid},${op.path}`,
      ],
      { cwd: dir }
    )
    return
  }
  if (op.kind === 'delete') {
    runGit(['update-index', '--force-remove', op.path], { cwd: dir })
    return
  }
  const [mode, blobOid] = runGitText(['ls-files', '-s', op.from], {
    cwd: dir,
  }).split(/\s+/)
  runGit(['update-index', '--force-remove', op.from], { cwd: dir })
  runGit(
    ['update-index', '--add', '--cacheinfo', `${mode},${blobOid},${op.to}`],
    { cwd: dir }
  )
}

// Plumbing-only commit construction (update-index --cacheinfo + write-tree +
// commit-tree): the working tree is never checked out, so building an
// executable file or a symlink never touches OS-level file permissions or
// symlink support — both are pure git tree-entry modes (100755 / 120000)
// recorded directly in the index.
const makeCommit = (
  dir: string,
  parent: string | null,
  message: string,
  ops: FixtureOp[]
): string => {
  for (const op of ops) applyOp(dir, op)
  const treeOid = runGitText(['write-tree'], { cwd: dir })
  const args = parent
    ? ['commit-tree', treeOid, '-p', parent, '-m', message]
    : ['commit-tree', treeOid, '-m', message]
  return runGitText(args, { cwd: dir })
}

export type RefNameFixture = {
  readonly branch: string // 'refs/heads/main'
  readonly branchName: string // 'main'
  readonly tag: string // 'refs/tags/v1'
  readonly tagName: string // 'v1'
  readonly tagOid: string // first commit
  readonly headOid: string // second commit, what HEAD resolves to
}

const REF_NAME_BRANCH = 'refs/heads/main'
const REF_NAME_BRANCH_NAME = 'main'
const REF_NAME_TAG = 'refs/tags/v1'
const REF_NAME_TAG_NAME = 'v1'

/**
 * Two commits so `tag` -> `branch` is a non-empty range: the first gets a
 * lightweight tag (points straight at the commit, no tag-object peeling),
 * the second becomes what `main` and `HEAD` resolve to. `symbolic-ref` — not
 * `update-ref HEAD <sha>` — pins the branch name: `update-ref HEAD` writes
 * through the symbolic HEAD into whatever branch `init.defaultBranch` chose
 * on that runner (`main` or `master`), which would leave the very thing this
 * fixture exists to pin runner-dependent.
 */
export const buildRefNameFixtureRepo = (
  dir: string,
  format: RepoFormat = FILES_SHA1
): RefNameFixture => {
  initRepo(dir, format)

  const tagOid = makeCommit(dir, null, 'tagged commit', [
    { kind: 'add', mode: '100644', path: 'README.md', content: 'first\n' },
  ])
  runGit(['update-ref', REF_NAME_TAG, tagOid], { cwd: dir })

  const headOid = makeCommit(dir, tagOid, 'head commit', [
    { kind: 'add', mode: '100644', path: 'src/index.txt', content: 'second\n' },
  ])
  runGit(['update-ref', REF_NAME_BRANCH, headOid], { cwd: dir })
  runGit(['symbolic-ref', 'HEAD', REF_NAME_BRANCH], { cwd: dir })

  return {
    branch: REF_NAME_BRANCH,
    branchName: REF_NAME_BRANCH_NAME,
    tag: REF_NAME_TAG,
    tagName: REF_NAME_TAG_NAME,
    tagOid,
    headOid,
  }
}

/**
 * Builds a fully self-contained history in `dir` (already an empty
 * directory) — a dozen-ish commits reachable only from within this repo, so
 * every scenario built on it is immune to the outer checkout's depth. Covers:
 * nested directories, an executable file, a POSIX symlink (skipped on
 * win32 — checking out a symlink tree entry through `git worktree add` is
 * not guaranteed portable there), a whitespace-only modification paired
 * with a real one, a genuine content-preserving rename, and enough depth
 * for a non-degenerate shallow clone.
 */
export const buildFixtureRepo = (dir: string): FixtureRefs => {
  initRepo(dir)

  const root = makeCommit(dir, null, 'root', [
    {
      kind: 'add',
      mode: '100644',
      path: 'README.md',
      content: 'the quick brown fox\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: WHITESPACE_ONLY_PATH,
      content: 'line one\nline two\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: 'src/lib/util.txt',
      content: 'utility content\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: 'docs/notes.txt',
      content: 'initial notes\n',
    },
  ])

  const nested = makeCommit(dir, root, 'add nested file', [
    {
      kind: 'add',
      mode: '100644',
      path: RENAME_FROM_PATH,
      content: 'deep content\n',
    },
  ])

  const executable = makeCommit(dir, nested, 'add executable script', [
    {
      kind: 'add',
      mode: '100755',
      path: EXECUTABLE_PATH,
      content: '#!/bin/sh\necho hi\n',
    },
  ])

  const diffFrom =
    process.platform === 'win32'
      ? executable
      : makeCommit(dir, executable, 'add symlink', [
          {
            kind: 'add',
            mode: '120000',
            path: SYMLINK_PATH,
            content: WHITESPACE_ONLY_PATH,
          },
        ])

  const withRealChange = makeCommit(
    dir,
    diffFrom,
    'expand release notes and add scoping fixtures',
    [
      {
        kind: 'add',
        mode: '100644',
        path: 'docs/notes.txt',
        content: `initial notes\n${GREP_MARKER} present\n`,
      },
      {
        kind: 'add',
        mode: '100644',
        path: PREFIX_COLLISION_PATH,
        content: 'a sibling that merely shares a name prefix with src\n',
      },
      {
        kind: 'add',
        mode: '100644',
        path: REGISTRY_RECOGNISED_PATH,
        content: 'public class FixtureClass {}\n',
      },
    ]
  )

  const withWhitespaceOnlyChange = makeCommit(
    dir,
    withRealChange,
    'reformat index (whitespace only)',
    [
      {
        kind: 'add',
        mode: '100644',
        path: WHITESPACE_ONLY_PATH,
        content: 'line one \nline two\n',
      },
    ]
  )

  const withDeletion = makeCommit(
    dir,
    withWhitespaceOnlyChange,
    'drop unused util',
    [{ kind: 'delete', path: 'src/lib/util.txt' }]
  )

  const diffTo = makeCommit(dir, withDeletion, 'add fixture marker file', [
    {
      kind: 'add',
      mode: '100644',
      path: 'src/lib/added.txt',
      content: `added file with ${GREP_MARKER} too\n`,
    },
  ])

  const renameTo = makeCommit(dir, diffTo, 'rename nested file', [
    { kind: 'rename', from: RENAME_FROM_PATH, to: RENAME_TO_PATH },
  ])

  const expandedNotes = makeCommit(dir, renameTo, 'note the rename', [
    {
      kind: 'add',
      mode: '100644',
      path: 'docs/notes.txt',
      content: `initial notes\n${GREP_MARKER} present\nrenamed the deep file\n`,
    },
  ])

  const bumpedReadme = makeCommit(dir, expandedNotes, 'bump readme', [
    {
      kind: 'add',
      mode: '100644',
      path: 'README.md',
      content: 'the quick brown fox jumps\n',
    },
  ])

  const head = makeCommit(dir, bumpedReadme, 'add final fixture file', [
    {
      kind: 'add',
      mode: '100644',
      path: 'src/final.txt',
      content: 'final content\n',
    },
  ])

  runGit(['update-ref', 'HEAD', head], { cwd: dir })

  return { root, diffFrom, diffTo, renameTo, head }
}

export type MetadataFixtureRefs = {
  // The very first commit — no parents. What getFirstCommitRef() resolves to.
  root: string
  // HEAD — carries both the root commit's resource and a second one added
  // on top of it.
  head: string
}

export const EXISTING_RESOURCE_META =
  'force-app/main/default/staticresources/ExistingResource/ExistingResource.resource-meta.xml'
export const EXISTING_RESOURCE_FILE =
  'force-app/main/default/staticresources/ExistingResource/images/logo.png'
export const NEW_RESOURCE_META =
  'force-app/main/default/staticresources/NewResource/NewResource.resource-meta.xml'
export const NEW_RESOURCE_FILE =
  'force-app/main/default/staticresources/NewResource/images/photo.png'

/**
 * A minimal SFDX-shaped history: a root commit carrying one nested
 * StaticResource bundle, and a second commit adding a sibling bundle on top
 * of it. Nested (bundle/subfolder/file) so metadata boundary resolution for
 * files under it walks through the git-backed scan path rather than
 * resolving in a single fromPath lookup — the shape the include path
 * (ADDITION from the root commit, DELETION back to it) exercises.
 */
export const buildMetadataFixtureRepo = (dir: string): MetadataFixtureRefs => {
  initRepo(dir)

  const root = makeCommit(dir, null, 'add existing static resource', [
    {
      kind: 'add',
      mode: '100644',
      path: EXISTING_RESOURCE_META,
      content:
        '<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata"/>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: EXISTING_RESOURCE_FILE,
      content: 'logo content\n',
    },
  ])

  const head = makeCommit(dir, root, 'add new static resource', [
    {
      kind: 'add',
      mode: '100644',
      path: NEW_RESOURCE_META,
      content:
        '<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata"/>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: NEW_RESOURCE_FILE,
      content: 'photo content\n',
    },
  ])

  runGit(['update-ref', 'HEAD', head], { cwd: dir })

  return { root, head }
}
