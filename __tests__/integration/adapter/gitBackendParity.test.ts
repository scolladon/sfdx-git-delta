'use strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable } from 'node:stream'

import { afterAll, afterEach, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'

const REPO_ROOT = process.cwd()
const FROM = 'HEAD~20'
const TO = 'HEAD'

// HEAD~20..HEAD carries no rename pair: the file that later became
// GitAdapter.ts was both born and renamed away inside that window, so a
// two-endpoint tree diff only ever sees a plain modify. This older pair
// predates the branch and carries a `git diff -M` detected rename.
const RENAME_FROM = '0197ef07be6328e6a5cdc6a8c67498f6a449974b'
const RENAME_TO = 'df3c8330076517fa1fdc9f73e60ce1ac54867ab2'

const GREP_PATTERN = 'EscalateToStreamingSignal'
const GREP_SCOPE = 'src'
const ARCHIVE_SCOPE = 'src/utils'

const TAR_BLOCK_SIZE = 512
const TAR_NAME_LENGTH = 100
const TAR_SIZE_OFFSET = 124
const TAR_SIZE_LENGTH = 12
const TAR_TYPEFLAG_OFFSET = 156
const TAR_REGULAR_FILE_TYPEFLAGS = new Set(['0', '\0'])

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: TO,
  from: FROM,
  output: '',
  source: ['.'],
  repo: REPO_ROOT,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

const runGit = (args: string[], cwd: string = REPO_ROOT): Buffer =>
  execFileSync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 })

const runGitText = (args: string[], cwd: string = REPO_ROOT): string =>
  runGit(args, cwd).toString('utf8')

const runGitLines = (args: string[], cwd: string = REPO_ROOT): string[] =>
  runGitText(args, cwd)
    .trim()
    .split('\n')
    .filter(line => line.length > 0)
    .sort()

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

const tempDirs: string[] = []

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

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

describe('Given the sfdx-git-delta repository', () => {
  describe('When resolving refs', () => {
    it('Then parseRev matches git rev-parse --verify', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await sut.parseRev(TO)

      // Assert
      expect(actual).toBe(runGitText(['rev-parse', '--verify', TO]).trim())
    })

    it('Then getFirstCommitRef matches git rev-list --max-parents=0 HEAD', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await sut.getFirstCommitRef()

      // Assert
      expect(actual).toBe(
        runGitText(['rev-list', '--max-parents=0', 'HEAD']).trim()
      )
    })
  })

  describe('When building the tree index', () => {
    it('Then getFilesPath matches git ls-tree --name-only -r HEAD', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(TO, [])

      // Act
      const actual = (await sut.getFilesPath('')).sort()

      // Assert
      const expected = runGitLines(['ls-tree', '--name-only', '-r', TO])
      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })

    it('Then listDirAtRevision and pathExists match git ls-tree children of a dir', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(TO, [])

      // Act
      const actualChildren = (
        await sut.listDirAtRevision('src/adapter', TO)
      ).sort()
      const actualExists = await sut.pathExists('src/adapter')
      const actualMissing = await sut.pathExists('src/does-not-exist')

      // Assert
      const expectedChildren = runGit([
        'ls-tree',
        '--name-only',
        TO,
        'src/adapter/',
      ])
        .toString('utf8')
        .trim()
        .split('\n')
        .map(path => path.replace('src/adapter/', ''))
        .sort()
      expect(actualChildren).toEqual(expectedChildren)
      expect(actualExists).toBe(true)
      expect(actualMissing).toBe(false)
    })
  })

  describe('When diffing two commits', () => {
    it('Then streamDiffLines matches git diff --name-status --no-renames --diff-filter=AMD', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await drainLines(sut.streamDiffLines())

      // Assert
      const expected = runGitLines([
        'diff',
        '--no-ext-diff',
        '--name-status',
        '--no-renames',
        '--diff-filter=AMD',
        FROM,
        TO,
      ])
      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })

    it('Then streamDiffLines with ignoreWhitespace matches --ignore-all-space --ignore-blank-lines', async () => {
      // Arrange
      const config = makeConfig({ ignoreWhitespace: true })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await drainLines(sut.streamDiffLines())

      // Assert
      const expected = runGitLines([
        'diff',
        '--no-ext-diff',
        '--name-status',
        '--no-renames',
        '--diff-filter=AMD',
        '--ignore-all-space',
        '--ignore-blank-lines',
        FROM,
        TO,
      ])
      expect(actual).toEqual(expected)
    })

    it('Then streamDiffLines with changesManifest set matches git diff -M --diff-filter=AMDR', async () => {
      // Arrange
      const config = makeConfig({
        from: RENAME_FROM,
        to: RENAME_TO,
        changesManifest: 'changes.json',
      })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await drainLines(sut.streamDiffLines())

      // Assert
      const expected = runGitLines([
        'diff',
        '--no-ext-diff',
        '--name-status',
        '-M',
        '--diff-filter=AMDR',
        RENAME_FROM,
        RENAME_TO,
      ])
      expect(actual.some(line => line.startsWith('R'))).toBe(true)
      expect(actual).toEqual(expected)
    })
  })

  describe('When reading blobs', () => {
    it('Then getBufferContent returns identical bytes to git cat-file blob', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(TO, [])
      const samples = (await sut.getFilesPath('src')).slice(0, 25)

      // Act
      const actual = await Promise.all(
        samples.map(path => sut.getBufferContent({ path, oid: TO }))
      )

      // Assert
      expect(samples.length).toBeGreaterThan(0)
      samples.forEach((path, index) => {
        const expected = runGit(['cat-file', 'blob', `${TO}:${path}`])
        expect(actual[index]?.equals(expected)).toBe(true)
      })
    })

    it('Then streamContent forwards identical bytes to git cat-file blob', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      const forRef = { path: 'package.json', oid: TO }

      // Act
      const actual = await readAll(sut.streamContent(forRef))

      // Assert
      const expected = runGit(['cat-file', 'blob', `${TO}:${forRef.path}`])
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
        TO
      )) {
        actual.set(path, await sizeOf(stream))
      }

      // Assert
      const archive = runGit([
        'archive',
        '--format=tar',
        TO,
        '--',
        ARCHIVE_SCOPE,
      ])
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
      const actual = (await sut.gitGrep(GREP_PATTERN, GREP_SCOPE, TO)).sort()

      // Assert
      const prefix = `${TO}:`
      const expected = runGitLines([
        'grep',
        '-l',
        GREP_PATTERN,
        TO,
        '--',
        GREP_SCOPE,
      ]).map(line => line.slice(prefix.length))
      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })
  })

  describe('When the repo is a worktree', () => {
    it('Then parseRev, getFilesPath and streamDiffLines match git run against the worktree', async () => {
      // Arrange: a `.git` FILE (gitdir: pointer), not a directory
      const parentDir = await createTempDir('sgd-parity-worktree-')
      const cloneDir = join(parentDir, 'clone')
      const worktreeDir = join(parentDir, 'wt')
      execFileSync('git', ['clone', REPO_ROOT, cloneDir])
      execFileSync('git', ['worktree', 'add', worktreeDir, 'HEAD~1'], {
        cwd: cloneDir,
      })
      const config = makeConfig({
        repo: worktreeDir,
        from: 'HEAD~1',
        to: 'HEAD',
      })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actualRev = await sut.parseRev('HEAD')
      await sut.preBuildTreeIndex('HEAD', [])
      const actualFiles = (await sut.getFilesPath('')).sort()
      const actualDiff = await drainLines(sut.streamDiffLines())

      // Assert
      expect(actualRev).toBe(
        runGitText(['rev-parse', '--verify', 'HEAD'], worktreeDir).trim()
      )
      expect(actualFiles).toEqual(
        runGitLines(['ls-tree', '--name-only', '-r', 'HEAD'], worktreeDir)
      )
      expect(actualDiff).toEqual(
        runGitLines(
          [
            'diff',
            '--no-ext-diff',
            '--name-status',
            '--no-renames',
            '--diff-filter=AMD',
            'HEAD~1',
            'HEAD',
          ],
          worktreeDir
        )
      )
    })
  })

  describe('When the repo is a shallow clone', () => {
    it('Then getFirstCommitRef matches the graft boundary reported by git rev-list', async () => {
      // Arrange: `--depth` is a no-op on local-path clones unless the
      // source is addressed as a file:// URL, so the shallow boundary is
      // only real when cloned through that scheme.
      const shallowDir = await createTempDir('sgd-parity-shallow-')
      execFileSync('git', [
        'clone',
        '--depth',
        '2',
        `file://${REPO_ROOT}`,
        shallowDir,
      ])
      const config = makeConfig({ repo: shallowDir })
      const sut = GitAdapter.getInstance(config)

      // Act
      const actual = await sut.getFirstCommitRef()

      // Assert
      expect(actual).toBe(
        runGitText(['rev-list', '--max-parents=0', 'HEAD'], shallowDir).trim()
      )
    })
  })
})
