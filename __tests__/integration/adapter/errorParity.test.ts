'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'
import type { Work } from '../../../src/types/work'
import ChangeSet from '../../../src/utils/changeSet'
import ConfigValidator from '../../../src/utils/configValidator'
import { createTempDir, runGit } from '../../__utils__/gitTestHarness'

// A missing oid that parses as a well-formed git object id shape but never
// resolves: tsgit rejects it with `OBJECT_NOT_FOUND: object not found:
// deadbeef`, the raw shape mapTsgitError narrows away from user output.
const MISSING_OID = 'deadbeef'
const RAW_CODE_LEAK_PATTERN = /OBJECT_NOT_FOUND|TsgitError|ENOENT.*realpath/

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
  output: '',
  source: ['.'],
  repo: '',
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

const makeWork = (config: Config): Work => ({
  config,
  changes: new ChangeSet(),
  warnings: [],
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
      const sut = new ConfigValidator(makeWork(config))

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
      const sut = new ConfigValidator(makeWork(config))

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toContain(
        `'${repoDir}' is not a git repository`
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
})
