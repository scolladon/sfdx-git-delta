'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'
import {
  buildFixtureRepo,
  type FixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// Characterizes a semantic contract that a follow-up commit relies on: a
// GitAdapter instance answers tree-index-backed reads (getFilesPath,
// pathExists, listDirAtRevision) per revision, and a revision nobody ever
// passed to preBuildTreeIndex reads back as empty/false rather than
// resolving lazily or throwing. That "unindexed reads as empty" contract is
// what makes the include path's DELETION pass currently resolve some
// metadata boundaries against an empty listing (see includeProcessor tests).

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
  output: '',
  source: sourceDirs('.'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

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

describe('Given a GitAdapter with the tree index built for only one revision', () => {
  describe('When reading at the revision that was never passed to preBuildTreeIndex', () => {
    it('Then getFilesPath returns an empty array', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(refs.diffTo, config.source)

      // Act
      const actual = await sut.getFilesPath('', refs.diffFrom)

      // Assert
      expect(actual).toEqual([])
    })

    it('Then pathExists returns false', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(refs.diffTo, config.source)

      // Act
      const actual = await sut.pathExists('README.md', refs.diffFrom)

      // Assert
      expect(actual).toBe(false)
    })

    it('Then listDirAtRevision returns an empty array', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(refs.diffTo, config.source)

      // Act
      const actual = await sut.listDirAtRevision('src', refs.diffFrom)

      // Assert
      expect(actual).toEqual([])
    })
  })

  describe('When reading at the revision that was pre-built', () => {
    it('Then getFilesPath, pathExists and listDirAtRevision return real data', async () => {
      // Arrange
      const config = makeConfig()
      const sut = GitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(refs.diffTo, config.source)

      // Act
      const actualFiles = await sut.getFilesPath('', refs.diffTo)
      const actualExists = await sut.pathExists('README.md', refs.diffTo)
      const actualChildren = await sut.listDirAtRevision('src', refs.diffTo)

      // Assert
      expect(actualFiles.length).toBeGreaterThan(0)
      expect(actualExists).toBe(true)
      expect(actualChildren.length).toBeGreaterThan(0)
    })
  })
})
