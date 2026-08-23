'use strict'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'
import ConfigValidator from '../../../src/utils/configValidator'
import { sanitizePath, treatPathSep } from '../../../src/utils/fsUtils'
import { createTempDir, runGit } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// A missing oid that parses as a well-formed git object id shape but never
// resolves: tsgit rejects it with `OBJECT_NOT_FOUND: object not found:
// deadbeef`, the raw shape mapTsgitError narrows away from user output.
const MISSING_OID = 'deadbeef'

// Every raw engine shape the mapper must narrow away before a message can
// reach a user: the object-lookup code, the four repository-acceptance
// refusal codes, 3.5.0's eager option-validation code, the error class
// name, and the pre-3.5.0 ENOENT/realpath shape the retired arm targeted.
const RAW_TSGIT_SHAPES = [
  'OBJECT_NOT_FOUND',
  'NOT_A_REPOSITORY',
  'REPOSITORY_FORMAT_VERSION_UNSUPPORTED',
  'REPOSITORY_EXTENSIONS_UNSUPPORTED',
  'REPOSITORY_EXTENSION_UNSUPPORTED',
  'INVALID_OPTION',
  'TsgitError',
  'ENOENT.*realpath',
]
const RAW_CODE_LEAK_PATTERN = new RegExp(RAW_TSGIT_SHAPES.join('|'))

// The adapter absolutizes and forward-slashes its repository path, so an
// expectation must compose it the same way (mkdtemp returns backslashes on
// win32, and resolve() adds a drive letter there).
const adapterRepoPath = (repoDir: string): string =>
  sanitizePath(resolve(repoDir))!

const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

// Plumbing-only commit (write-tree + commit-tree + update-ref): avoids
// invoking porcelain `git commit`, which would consult the host's
// `commit.gpgsign` — this throwaway fixture repo has no business
// triggering a signing prompt.
const initRepoWithCommit = (repoDir: string): void => {
  runGit(['init', '--quiet'], { cwd: repoDir })
  const treeOid = runGit(['write-tree'], { cwd: repoDir })
    .toString('utf8')
    .trim()
  const commitOid = runGit(['commit-tree', treeOid, '-m', 'root'], {
    cwd: repoDir,
  })
    .toString('utf8')
    .trim()
  runGit(['update-ref', 'HEAD', commitOid], { cwd: repoDir })
}

const makeConfig = (overrides: Partial<Config>): Config => ({
  to: 'HEAD',
  from: 'HEAD',
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: '',
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

afterAll(async () => {
  await GitAdapter.closeAll()
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given the released error-message contract (validated surface)', () => {
  describe('When ConfigValidator validates a non-existent git SHA', () => {
    it('Then it throws the released error.ParameterIsNotGitSHA message', async () => {
      // Arrange
      const repoDir = await trackedTempDir('sgd-error-parity-sha-')
      initRepoWithCommit(repoDir)
      const config = makeConfig({
        repo: repoDir,
        to: 'not-a-real-ref-zzz',
        from: 'HEAD',
      })
      const sut = new ConfigValidator(config)

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        "--to is not a valid sha pointer: 'not-a-real-ref-zzz' (If in CI/CD context, check the fetch depth is properly set)"
      )
    })
  })

  describe('When ConfigValidator validates a repo path with no .git directory', () => {
    it('Then it throws the released error.PathIsNotGit message', async () => {
      // Arrange
      const repoDir = await trackedTempDir('sgd-error-parity-nogit-')
      const config = makeConfig({ repo: repoDir })
      const sut = new ConfigValidator(config)

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert — the CLI sanitizes paths to forward slashes before they
      // reach messages, so the expected value gets the same treatment
      // (on win32 mkdtemp returns a backslashed path).
      expect((error as Error).message).toContain(
        `'${treatPathSep(repoDir)}' is not a git repository`
      )
    })
  })
})

describe('Given a wrapped GitAdapter method that bypasses ConfigValidator (non-validated surface)', () => {
  describe('When getFirstCommitRef runs against a repo with no commits', () => {
    it('Then it rejects with a mapped error that never leaks the raw tsgit shape', async () => {
      // Arrange
      const repoDir = await trackedTempDir('sgd-error-parity-empty-')
      runGit(['init', '--quiet'], { cwd: repoDir })
      const sut = GitAdapter.getInstance(makeConfig({ repo: repoDir }))

      // Act
      const error = await sut
        .getFirstCommitRef()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toMatch(RAW_CODE_LEAK_PATTERN)
    })
  })

  describe('When parseRev runs against a missing oid', () => {
    it('Then it rejects with a mapped error that never leaks the raw tsgit shape', async () => {
      // Arrange
      const repoDir = await trackedTempDir('sgd-error-parity-badoid-')
      initRepoWithCommit(repoDir)
      const sut = GitAdapter.getInstance(makeConfig({ repo: repoDir }))

      // Act
      const error = await sut
        .parseRev(MISSING_OID)
        .catch((thrown: unknown) => thrown)

      // Assert
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toMatch(RAW_CODE_LEAK_PATTERN)
    })
  })

  describe('When parseRev runs against a repository declaring an unsupported format version', () => {
    it('Then it rejects naming the repository, mapped to the unreadable-format message', async () => {
      // Arrange
      const repoDir = await trackedTempDir('sgd-error-parity-formatv-')
      initRepoWithCommit(repoDir)
      runGit(['config', 'core.repositoryformatversion', '99'], {
        cwd: repoDir,
      })
      const sut = GitAdapter.getInstance(makeConfig({ repo: repoDir }))

      // Act
      const error = await sut
        .parseRev('HEAD')
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        `'${adapterRepoPath(repoDir)}' uses a repository format this version of sgd cannot read`
      )
      expect((error as Error).message).not.toMatch(RAW_CODE_LEAK_PATTERN)
    })
  })

  describe('When parseRev runs against a directory with no .git', () => {
    it('Then it rejects naming the repository, mapped to the not-a-repository message', async () => {
      // Arrange
      const repoDir = await trackedTempDir('sgd-error-parity-nogit-adapter-')
      const sut = GitAdapter.getInstance(makeConfig({ repo: repoDir }))

      // Act
      const error = await sut
        .parseRev('HEAD')
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        `'${adapterRepoPath(repoDir)}' is not a git repository`
      )
      expect((error as Error).message).not.toMatch(RAW_CODE_LEAK_PATTERN)
    })
  })
})
