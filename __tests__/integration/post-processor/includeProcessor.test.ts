'use strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import IncludeProcessor from '../../../src/post-processor/includeProcessor'
import type { Config } from '../../../src/types/config'
import ChangeSet from '../../../src/utils/changeSet'
import { IgnoreHelper } from '../../../src/utils/ignoreHelper'
import {
  buildMetadataFixtureRepo,
  EXISTING_RESOURCE_FILE,
  type MetadataFixtureRefs,
  NEW_RESOURCE_FILE,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// Characterizes IncludeProcessor.transformAndCollect end-to-end, against a
// real fixture repo and a real GitAdapter (no adapter mocks). This locks in
// today's output as the reference the pool-key rebind (GitAdapter keyed by
// repo instead of by repo+to) must reproduce byte-for-byte.
//
// generateDelta is left off: it only toggles whether copy operations are
// additionally collected (an orthogonal concern to which GitAdapter instance
// resolves a boundary), and turning it on adds copy-path noise that isn't
// what this suite is pinning down. The tree index is still pre-built by hand
// here, mirroring the precondition main.ts establishes before it runs the
// include pass in a --generate-delta invocation.

let fixtureDir: string
let refs: MetadataFixtureRefs
let includeDir: string
let metadata: MetadataRepository
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const writeIncludePatterns = async (
  fileName: string,
  paths: readonly string[]
): Promise<string> => {
  const patternFile = join(includeDir, fileName)
  await writeFile(patternFile, `${paths.join('\n')}\n`)
  return patternFile
}

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: refs.head,
  from: refs.head,
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-include-fixture-')
  refs = buildMetadataFixtureRepo(fixtureDir)
  includeDir = await trackedTempDir('sgd-include-patterns-')
  await mkdir(includeDir, { recursive: true })
  metadata = await getDefinition({})
})

afterEach(async () => {
  // Both GitAdapter and IgnoreHelper.buildInclude cache singletons keyed on
  // first call: reset both so one test's config can never leak into the next.
  await GitAdapter.closeAll()
  IgnoreHelper.resetIncludeInstance()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a fixture repo with a resource added on top of the root commit', () => {
  describe('When only --include forces a path onto the ADDITION pass', () => {
    it('Then transformAndCollect resolves it through the correctly-indexed GitAdapter instance', async () => {
      // Arrange
      const includePath = await writeIncludePatterns('include-addition.txt', [
        NEW_RESOURCE_FILE,
      ])
      const config = makeConfig({ include: includePath })
      const gitAdapter = GitAdapter.getInstance(config)
      await gitAdapter.preBuildTreeIndex(config.to, config.source)
      const sut = new IncludeProcessor(config, metadata)

      // Act
      const actual = await sut.transformAndCollect(ChangeSet.from([]))

      // Assert
      expect(actual).toEqual({
        elements: [
          {
            target: 'package',
            type: 'StaticResource',
            member: 'NewResource',
            changeKind: 'add',
          },
        ],
        copies: [],
        warnings: [],
      })
    })
  })

  describe('When only --include-destructive forces a path onto the DELETION pass', () => {
    it('Then transformAndCollect resolves it through the DELETION pass GitAdapter instance keyed on the first commit', async () => {
      // Arrange
      const includeDestructivePath = await writeIncludePatterns(
        'include-deletion.txt',
        [EXISTING_RESOURCE_FILE]
      )
      const config = makeConfig({ includeDestructive: includeDestructivePath })
      const gitAdapter = GitAdapter.getInstance(config)
      await gitAdapter.preBuildTreeIndex(config.to, config.source)
      const sut = new IncludeProcessor(config, metadata)

      // Act
      const actual = await sut.transformAndCollect(ChangeSet.from([]))

      // Assert
      expect(actual).toEqual({
        elements: [
          {
            target: 'destructiveChanges',
            type: 'StaticResource',
            member: 'ExistingResource',
            changeKind: 'delete',
          },
        ],
        copies: [],
        warnings: [],
      })
    })
  })

  describe('When both --include and --include-destructive force lines onto their respective passes', () => {
    it('Then transformAndCollect merges the ADDITION and DELETION results into one HandlerResult', async () => {
      // Arrange
      const includePath = await writeIncludePatterns('include-both-add.txt', [
        NEW_RESOURCE_FILE,
      ])
      const includeDestructivePath = await writeIncludePatterns(
        'include-both-delete.txt',
        [EXISTING_RESOURCE_FILE]
      )
      const config = makeConfig({
        include: includePath,
        includeDestructive: includeDestructivePath,
      })
      const gitAdapter = GitAdapter.getInstance(config)
      await gitAdapter.preBuildTreeIndex(config.to, config.source)
      const sut = new IncludeProcessor(config, metadata)

      // Act
      const actual = await sut.transformAndCollect(ChangeSet.from([]))

      // Assert
      expect(actual).toEqual({
        elements: [
          {
            target: 'package',
            type: 'StaticResource',
            member: 'NewResource',
            changeKind: 'add',
          },
          {
            target: 'destructiveChanges',
            type: 'StaticResource',
            member: 'ExistingResource',
            changeKind: 'delete',
          },
        ],
        copies: [],
        warnings: [],
      })
    })
  })
})
