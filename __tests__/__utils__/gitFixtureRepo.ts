'use strict'
import { runGit, runGitText } from './gitTestHarness'

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
  runGit(['init', '--quiet'], { cwd: dir })

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
