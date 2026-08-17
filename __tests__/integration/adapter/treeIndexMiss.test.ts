'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { TreeIndex } from '../../../src/adapter/treeIndex'
import {
  createTreeReader,
  type TreeReader,
} from '../../../src/adapter/treeReader'
import type { Config } from '../../../src/types/config'
import {
  buildFixtureRepo,
  type FixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// Characterizes a semantic contract every reader relies on: a TreeReader
// built for only one revision answers any OTHER revision with the same
// empty/false result the Null Object (an empty TreeIndex) always produces —
// rather than resolving lazily or throwing. That "unindexed reads as empty"
// contract is what makes the include path's DELETION pass currently resolve
// some metadata boundaries against an empty listing (see includeProcessor
// tests).
//
// Caller ownership (see treeIndexScopeRegression.test.ts) means this can no
// longer happen from a scope-key mismatch — the reader here is built with
// GitAdapter.buildTreeIndex + createTreeReader, the same primitives
// main.ts uses, exercised directly instead of through the full pipeline.

let fixtureDir: string
let refs: FixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: 'HEAD',
  from: 'HEAD',
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

const buildReaderForOnly = async (
  gitAdapter: GitAdapter,
  revision: string,
  scopePaths: readonly string[]
): Promise<TreeReader> => {
  const index = await gitAdapter.buildTreeIndex(revision, scopePaths)
  return createTreeReader(new Map<string, TreeIndex>([[revision, index!]]))
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-treeindex-fixture-')
  refs = buildFixtureRepo(fixtureDir)
})

afterEach(async () => {
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a TreeReader built for only one revision', () => {
  describe('When reading at the revision that was never built', () => {
    it('Then filesUnder returns an empty array', async () => {
      // Arrange
      const config = makeConfig()
      const gitAdapter = GitAdapter.getInstance(config)
      const sut = await buildReaderForOnly(
        gitAdapter,
        refs.diffTo,
        config.source
      )

      // Act
      const actual = sut.filesUnder(refs.diffFrom, '')

      // Assert
      expect(actual).toEqual([])
    })

    it('Then pathExists returns false', async () => {
      // Arrange
      const config = makeConfig()
      const gitAdapter = GitAdapter.getInstance(config)
      const sut = await buildReaderForOnly(
        gitAdapter,
        refs.diffTo,
        config.source
      )

      // Act
      const actual = sut.pathExists(refs.diffFrom, 'README.md')

      // Assert
      expect(actual).toBe(false)
    })

    it('Then children returns an empty array', async () => {
      // Arrange
      const config = makeConfig()
      const gitAdapter = GitAdapter.getInstance(config)
      const sut = await buildReaderForOnly(
        gitAdapter,
        refs.diffTo,
        config.source
      )

      // Act
      const actual = sut.children(refs.diffFrom, 'src')

      // Assert
      expect(actual).toEqual([])
    })
  })

  describe('When reading at the revision that was built', () => {
    it('Then filesUnder, pathExists and children return real data', async () => {
      // Arrange
      const config = makeConfig()
      const gitAdapter = GitAdapter.getInstance(config)
      const sut = await buildReaderForOnly(
        gitAdapter,
        refs.diffTo,
        config.source
      )

      // Act
      const actualFiles = sut.filesUnder(refs.diffTo, '')
      const actualExists = sut.pathExists(refs.diffTo, 'README.md')
      const actualChildren = sut.children(refs.diffTo, 'src')

      // Assert
      expect(actualFiles.length).toBeGreaterThan(0)
      expect(actualExists).toBe(true)
      expect(actualChildren.length).toBeGreaterThan(0)
    })
  })
})
