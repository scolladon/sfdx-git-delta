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

export type RootAnchoredFixtureRefs = {
  // Adds the class pair, the aura bundle, the lwc bundle, and a plain class
  // sitting at the repository root with no directory above it.
  root: string
  // From `root`: deletes the class pair and both bundles, leaves the
  // root-level class untouched.
  deleted: string
  // From `root`: renames the root-level class into `classes/`.
  moved: string
}

export const ROOT_ANCHORED_CLASS = 'classes/AccountService.cls'
export const ROOT_ANCHORED_CLASS_META = 'classes/AccountService.cls-meta.xml'
export const ROOT_ANCHORED_AURA_MARKUP = 'aura/accountCard/accountCard.cmp'
export const ROOT_ANCHORED_AURA_CONTROLLER =
  'aura/accountCard/accountCardController.js'
export const ROOT_ANCHORED_BUNDLE_MARKUP = 'lwc/accountCard/accountCard.html'
export const ROOT_ANCHORED_BUNDLE_SCRIPT = 'lwc/accountCard/accountCard.js'
export const ROOT_ANCHORED_BUNDLE_META =
  'lwc/accountCard/accountCard.js-meta.xml'
export const ROOT_ANCHORED_MOVED_CLASS = 'Ledger.cls'
export const ROOT_ANCHORED_MOVED_CLASS_TO = 'classes/Ledger.cls'

/**
 * A package laid out at the repository root (no `force-app/main/default`
 * prefix): every metadata type directory sits in path segment 0, exactly
 * where a git diff-status letter and tab also land. The aura and lwc
 * bundles carry no registry-known suffix, so only the directory walk can
 * recognise them; `Ledger.cls` at the root is the shape whose diff-line key
 * carries the status prefix inside it today.
 */
export const buildRootAnchoredFixtureRepo = (
  dir: string
): RootAnchoredFixtureRefs => {
  initRepo(dir)

  const root = makeCommit(dir, null, 'root', [
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_CLASS,
      content: 'public class AccountService {}\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_CLASS_META,
      content: '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"/>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_AURA_MARKUP,
      content: '<aura:component/>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_AURA_CONTROLLER,
      content: '({})\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_BUNDLE_MARKUP,
      content: '<template></template>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_BUNDLE_SCRIPT,
      content: 'export default class {}\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_BUNDLE_META,
      content:
        '<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"/>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: ROOT_ANCHORED_MOVED_CLASS,
      content: 'public class Ledger {}\n',
    },
  ])

  const deleted = makeCommit(dir, root, 'delete class and bundles', [
    { kind: 'delete', path: ROOT_ANCHORED_CLASS },
    { kind: 'delete', path: ROOT_ANCHORED_CLASS_META },
    { kind: 'delete', path: ROOT_ANCHORED_AURA_MARKUP },
    { kind: 'delete', path: ROOT_ANCHORED_AURA_CONTROLLER },
    { kind: 'delete', path: ROOT_ANCHORED_BUNDLE_MARKUP },
    { kind: 'delete', path: ROOT_ANCHORED_BUNDLE_SCRIPT },
    { kind: 'delete', path: ROOT_ANCHORED_BUNDLE_META },
  ])

  // `deleted` above left the index holding its own tree, not `root`'s — the
  // index is a single persistent file across these plumbing-only commits,
  // not reset per commit. Re-seed it from `root` so this sibling commit
  // branches off `root` instead of continuing from `deleted`.
  runGit(['read-tree', root], { cwd: dir })

  const moved = makeCommit(dir, root, 'move class out of the repository root', [
    {
      kind: 'rename',
      from: ROOT_ANCHORED_MOVED_CLASS,
      to: ROOT_ANCHORED_MOVED_CLASS_TO,
    },
  ])

  return { root, deleted, moved }
}

export type IgnoreFixtureRefs = {
  // Adds the class pair and the lwc bundle under the source directory.
  root: string
  // From `root`: renames both class files into the sibling recycle-bin directory.
  moved: string
  // From `root`: renames one bundle file into the recycle-bin directory while
  // the bundle's two other files stay where they are — a stale ignored copy
  // of a component that is still alive.
  staleCopy: string
}

export const IGNORE_SOURCE_CLASS =
  'force-app/main/default/classes/AccountService.cls'
export const IGNORE_SOURCE_CLASS_META =
  'force-app/main/default/classes/AccountService.cls-meta.xml'
export const IGNORE_MOVED_CLASS =
  'force-app/recycle-bin/classes/AccountService.cls'
export const IGNORE_MOVED_CLASS_META =
  'force-app/recycle-bin/classes/AccountService.cls-meta.xml'
const IGNORE_BUNDLE_SCRIPT = 'force-app/main/default/lwc/foo/foo.js'
export const IGNORE_BUNDLE_MARKUP = 'force-app/main/default/lwc/foo/foo.html'
const IGNORE_BUNDLE_META = 'force-app/main/default/lwc/foo/foo.js-meta.xml'
export const IGNORE_BUNDLE_STALE_MARKUP =
  'force-app/recycle-bin/lwc/foo/foo.html'

/**
 * A class and its meta companion, moved wholesale into a sibling directory —
 * both paths resolve to the one ApexClass component, which is what the
 * cancellation rule exists for. Exists to drive the real ignore-before/
 * after-registration ordering against a fixture an `--ignore-file` pattern
 * can target by directory. `root` also carries an untouched lwc bundle so a
 * sibling commit can move just one of its files into the recycle bin,
 * leaving the bundle live at `to` — a stale ignored copy rather than a move.
 */
export const buildIgnoreFixtureRepo = (dir: string): IgnoreFixtureRefs => {
  initRepo(dir)

  const root = makeCommit(dir, null, 'add class pair', [
    {
      kind: 'add',
      mode: '100644',
      path: IGNORE_SOURCE_CLASS,
      content: 'public class AccountService {}\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: IGNORE_SOURCE_CLASS_META,
      content: '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"/>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: IGNORE_BUNDLE_SCRIPT,
      content: 'export default class {}\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: IGNORE_BUNDLE_MARKUP,
      content: '<template></template>\n',
    },
    {
      kind: 'add',
      mode: '100644',
      path: IGNORE_BUNDLE_META,
      content:
        '<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"/>\n',
    },
  ])

  const moved = makeCommit(dir, root, 'move class pair to the recycle bin', [
    { kind: 'rename', from: IGNORE_SOURCE_CLASS, to: IGNORE_MOVED_CLASS },
    {
      kind: 'rename',
      from: IGNORE_SOURCE_CLASS_META,
      to: IGNORE_MOVED_CLASS_META,
    },
  ])

  // `moved` above left the index holding its own tree, not `root`'s — the
  // index is a single persistent file across these plumbing-only commits,
  // not reset per commit. Re-seed it from `root` so this sibling commit
  // branches off `root` instead of continuing from `moved`.
  runGit(['read-tree', root], { cwd: dir })

  const staleCopy = makeCommit(
    dir,
    root,
    'move one bundle file to the recycle bin',
    [
      {
        kind: 'rename',
        from: IGNORE_BUNDLE_MARKUP,
        to: IGNORE_BUNDLE_STALE_MARKUP,
      },
    ]
  )

  return { root, moved, staleCopy }
}
