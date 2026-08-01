'use strict'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Readable } from 'node:stream'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'
import {
  ARCHIVE_SCOPE,
  buildFixtureRepo,
  type FixtureRefs,
  GREP_MARKER,
  RENAME_FROM_PATH,
  RENAME_TO_PATH,
  WHITESPACE_ONLY_PATH,
} from '../../__utils__/gitFixtureRepo'
import {
  createTempDir,
  runGit,
  runGitLines,
  runGitText,
  toFileUrl,
} from '../../__utils__/gitTestHarness'

const TAR_BLOCK_SIZE = 512
const TAR_NAME_LENGTH = 100
const TAR_SIZE_OFFSET = 124
const TAR_SIZE_LENGTH = 12
const TAR_TYPEFLAG_OFFSET = 156
const TAR_REGULAR_FILE_TYPEFLAGS = new Set(['0', '\0'])
const SHALLOW_DEPTH = '3'

let fixtureDir: string
let refs: FixtureRefs
const tempDirs: string[] = []

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: 'HEAD',
  from: 'HEAD',
  output: '',
  source: ['.'],
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

const drainLines = async (
  generator: AsyncGenerator<string>
): Promise<string[]> => {
  const lines: string[] = []
  for await (const line of generator) {
    lines.push(line)
  }
  return lines.sort()
}

const readAll = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

const sizeOf = async (stream: Readable): Promise<number> => {
  let total = 0
  for await (const chunk of stream) {
    total += (chunk as Buffer).length
  }
  return total
}

// Minimal POSIX ustar reader: `git archive` output has no npm-installed
// parser available since tar-stream was dropped with the subprocess
// backend, and shelling out to the host `tar` binary would make the
// oracle's field layout depend on which tar flavour (GNU/BSD) runs the
// suite. Walking the fixed-width ustar header is deterministic everywhere.
const readTarField = (header: Buffer, offset: number, length: number): string =>
  header
    .subarray(offset, offset + length)
    .toString('utf8')
    .replace(/\0[\s\S]*$/, '')
    .trim()

const parseTarEntries = (archive: Buffer): Map<string, number> => {
  const entries = new Map<string, number>()
  let offset = 0
  while (offset + TAR_BLOCK_SIZE <= archive.length) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_SIZE)
    if (header.every(byte => byte === 0)) break
    const name = readTarField(header, 0, TAR_NAME_LENGTH)
    const size = parseInt(
      readTarField(header, TAR_SIZE_OFFSET, TAR_SIZE_LENGTH) || '0',
      8
    )
    const typeflag = String.fromCharCode(header[TAR_TYPEFLAG_OFFSET] ?? 0)
    offset += TAR_BLOCK_SIZE + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE
    if (TAR_REGULAR_FILE_TYPEFLAGS.has(typeflag)) {
      entries.set(name, size)
    }
  }
  return entries
}

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-parity-fixture-')
  refs = buildFixtureRepo(fixtureDir)
})

afterEach(async () => {
  // Instances are cached per (repo, to): closing after every test forces
  // the next getInstance() to rebuild from the config that test actually
  // passed in, instead of silently reusing a sibling test's cached config.
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a self-contained git fixture repository', () => {
  describe('When resolving refs', () => {
    it('Then parseRev matches git rev-parse --verify', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await sut.parseRev('HEAD')

      // Assert
      expect(actual).toBe(
        runGitText(['rev-parse', '--verify', 'HEAD'], { cwd: fixtureDir })
      )
    })

    it('Then getFirstCommitRef matches git rev-list --max-parents=0 HEAD', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await sut.getFirstCommitRef()

      // Assert
      expect(actual).toBe(refs.root)
      expect(actual).toBe(
        runGitText(['rev-list', '--max-parents=0', 'HEAD'], { cwd: fixtureDir })
      )
    })
  })

  describe('When building the tree index', () => {
    it('Then getFilesPath matches git ls-tree --name-only -r HEAD', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex('HEAD', [])

      // Act
      const actual = (await sut.getFilesPath('')).sort()

      // Assert
      const expected = runGitLines(['ls-tree', '--name-only', '-r', 'HEAD'], {
        cwd: fixtureDir,
      })
      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })

    it('Then listDirAtRevision and pathExists match git ls-tree children of a dir', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex('HEAD', [])

      // Act
      const actualChildren = (await sut.listDirAtRevision('src', 'HEAD')).sort()
      const actualExists = await sut.pathExists('src')
      const actualMissing = await sut.pathExists('src/does-not-exist')

      // Assert
      const expectedChildren = runGit(
        ['ls-tree', '--name-only', 'HEAD', 'src/'],
        {
          cwd: fixtureDir,
        }
      )
        .toString('utf8')
        .trim()
        .split('\n')
        .map(path => path.replace('src/', ''))
        .sort()
      expect(actualChildren).toEqual(expectedChildren)
      expect(actualExists).toBe(true)
      expect(actualMissing).toBe(false)
    })
  })

  describe('When diffing two commits', () => {
    it('Then streamDiffLines matches git diff --name-status --no-renames --diff-filter=AMD', async () => {
      // Arrange
      const config = makeConfig({ from: refs.diffFrom, to: refs.diffTo })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await drainLines(sut.streamDiffLines())

      // Assert
      const expected = runGitLines(
        [
          'diff',
          '--no-ext-diff',
          '--name-status',
          '--no-renames',
          '--diff-filter=AMD',
          refs.diffFrom,
          refs.diffTo,
        ],
        { cwd: fixtureDir }
      )
      expect(actual.length).toBeGreaterThan(0)
      expect(actual.some(line => line.endsWith(WHITESPACE_ONLY_PATH))).toBe(
        true
      )
      expect(actual).toEqual(expected)
    })

    it('Then streamDiffLines with ignoreWhitespace matches --ignore-all-space --ignore-blank-lines', async () => {
      // Arrange
      const config = makeConfig({
        from: refs.diffFrom,
        to: refs.diffTo,
        ignoreWhitespace: true,
      })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await drainLines(sut.streamDiffLines())

      // Assert: the whitespace-only edit to src/index.txt must drop out —
      // proof the option changes behaviour rather than the two commands
      // coincidentally agreeing.
      const expected = runGitLines(
        [
          'diff',
          '--no-ext-diff',
          '--name-status',
          '--no-renames',
          '--diff-filter=AMD',
          '--ignore-all-space',
          '--ignore-blank-lines',
          refs.diffFrom,
          refs.diffTo,
        ],
        { cwd: fixtureDir }
      )
      expect(actual.some(line => line.endsWith(WHITESPACE_ONLY_PATH))).toBe(
        false
      )
      expect(actual).toEqual(expected)
    })

    it('Then streamDiffLines with changesManifest set matches git diff -M --diff-filter=AMDR', async () => {
      // Arrange
      const config = makeConfig({
        from: refs.diffTo,
        to: refs.renameTo,
        changesManifest: 'changes.json',
      })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await drainLines(sut.streamDiffLines())

      // Assert
      const expected = runGitLines(
        [
          'diff',
          '--no-ext-diff',
          '--name-status',
          '-M',
          '--diff-filter=AMDR',
          refs.diffTo,
          refs.renameTo,
        ],
        { cwd: fixtureDir }
      )
      expect(
        actual.some(
          line =>
            line.startsWith('R') &&
            line.includes(RENAME_FROM_PATH) &&
            line.includes(RENAME_TO_PATH)
        )
      ).toBe(true)
      expect(actual).toEqual(expected)
    })
  })

  describe('When reading blobs', () => {
    it('Then getBufferContent returns identical bytes to git cat-file blob', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex('HEAD', [])
      const paths = (await sut.getFilesPath('')).sort()

      // Act
      const actual = await Promise.all(
        paths.map(path => sut.getBufferContent({ path, oid: 'HEAD' }))
      )

      // Assert
      expect(paths.length).toBeGreaterThan(0)
      paths.forEach((path, index) => {
        const expected = runGit(['cat-file', 'blob', `HEAD:${path}`], {
          cwd: fixtureDir,
        })
        expect(actual[index]?.equals(expected)).toBe(true)
      })
    })

    it('Then streamContent forwards identical bytes to git cat-file blob', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      const forRef = { path: 'README.md', oid: 'HEAD' }

      // Act
      const actual = await readAll(sut.streamContent(forRef))

      // Assert
      const expected = runGit(['cat-file', 'blob', `HEAD:${forRef.path}`], {
        cwd: fixtureDir,
      })
      expect(actual.equals(expected)).toBe(true)
    })
  })

  describe('When streaming a directory archive', () => {
    it('Then streamArchive matches git archive --format=tar entries and sizes', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = new Map<string, number>()
      for await (const { path, stream } of sut.streamArchive(
        ARCHIVE_SCOPE,
        'HEAD'
      )) {
        actual.set(path, await sizeOf(stream))
      }

      // Assert
      const archive = runGit(
        ['archive', '--format=tar', 'HEAD', '--', ARCHIVE_SCOPE],
        { cwd: fixtureDir }
      )
      const expected = parseTarEntries(archive)
      expect(actual.size).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })
  })

  describe('When grepping at a revision', () => {
    it('Then gitGrep matches git grep -l for the same literal pattern', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = (await sut.gitGrep(GREP_MARKER, '.', 'HEAD')).sort()

      // Assert
      const prefix = 'HEAD:'
      const expected = runGitLines(
        ['grep', '-l', GREP_MARKER, 'HEAD', '--', '.'],
        { cwd: fixtureDir }
      ).map(line => line.slice(prefix.length))
      expect(actual.length).toBeGreaterThan(1)
      expect(actual).toEqual(expected)
    })
  })

  describe('When the repo is a worktree', () => {
    it('Then parseRev, getFilesPath and streamDiffLines match git run against the worktree', async () => {
      // Arrange: a `.git` FILE (gitdir: pointer), not a directory. Checks
      // out `diffFrom` (an absolute oid, not a relative HEAD~N) so this
      // scenario never depends on how deep the fixture's own history is.
      const parentDir = await trackedTempDir('sgd-parity-worktree-')
      const cloneDir = join(parentDir, 'clone')
      const worktreeDir = join(parentDir, 'wt')
      runGit(['clone', fixtureDir, cloneDir])
      runGit(['worktree', 'add', worktreeDir, refs.diffFrom], {
        cwd: cloneDir,
      })
      const config = makeConfig({
        repo: worktreeDir,
        from: refs.diffFrom,
        to: refs.diffTo,
      })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actualRev = await sut.parseRev('HEAD')
      await sut.preBuildTreeIndex('HEAD', [])
      const actualFiles = (await sut.getFilesPath('', 'HEAD')).sort()
      const actualDiff = await drainLines(sut.streamDiffLines())

      // Assert
      expect(actualRev).toBe(
        runGitText(['rev-parse', '--verify', 'HEAD'], { cwd: worktreeDir })
      )
      expect(actualFiles).toEqual(
        runGitLines(['ls-tree', '--name-only', '-r', 'HEAD'], {
          cwd: worktreeDir,
        })
      )
      expect(actualDiff).toEqual(
        runGitLines(
          [
            'diff',
            '--no-ext-diff',
            '--name-status',
            '--no-renames',
            '--diff-filter=AMD',
            refs.diffFrom,
            refs.diffTo,
          ],
          { cwd: worktreeDir }
        )
      )
    })
  })

  describe('When the revision is an annotated tag', () => {
    it('Then tree index and content reads match git peeling the tag to its commit', async () => {
      // Arrange: annotated tags resolve to the tag OBJECT (no auto-peel from
      // rev-parse), so the adapter must peel the chain like `git ls-tree`.
      const tagDir = await trackedTempDir('sgd-parity-tag-')
      runGit(['clone', fixtureDir, tagDir])
      runGit(
        ['-c', 'tag.gpgSign=false', 'tag', '-a', 'parity-tag', '-m', 'parity'],
        { cwd: tagDir }
      )
      const config = makeConfig({ repo: tagDir, to: 'parity-tag' })
      const sut = GitAdapter.getInstance(config)

      // Act
      await sut.preBuildTreeIndex('parity-tag', [])
      const actualFiles = (await sut.getFilesPath('')).sort()
      const actualContent = await sut.getBufferContent({
        path: 'README.md',
        oid: 'parity-tag',
      })

      // Assert
      expect(actualFiles.length).toBeGreaterThan(0)
      expect(actualFiles).toEqual(
        runGitLines(['ls-tree', '--name-only', '-r', 'parity-tag'], {
          cwd: tagDir,
        })
      )
      const expectedContent = runGit(
        ['cat-file', 'blob', 'parity-tag:README.md'],
        { cwd: tagDir }
      )
      expect(actualContent.equals(expectedContent)).toBe(true)
    })
  })

  describe('When the repo is a shallow clone', () => {
    it('Then getFirstCommitRef matches the graft boundary reported by git rev-list', async () => {
      // Arrange: `--depth` is a documented no-op on local-path clones unless
      // the source is addressed as a file:// URL.
      const shallowDir = await trackedTempDir('sgd-parity-shallow-')
      runGit([
        'clone',
        '--depth',
        SHALLOW_DEPTH,
        toFileUrl(fixtureDir),
        shallowDir,
      ])
      const config = makeConfig({ repo: shallowDir })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await sut.getFirstCommitRef()

      // Assert — the clone must actually be shallow, otherwise the graft
      // boundary silently degenerates to the fixture's true root and the
      // scenario stops exercising `.git/shallow` at all.
      expect(existsSync(join(shallowDir, '.git', 'shallow'))).toBe(true)
      expect(actual).not.toBe(refs.root)
      expect(actual).toBe(
        runGitText(['rev-list', '--max-parents=0', 'HEAD'], { cwd: shallowDir })
      )
    })
  })
})
