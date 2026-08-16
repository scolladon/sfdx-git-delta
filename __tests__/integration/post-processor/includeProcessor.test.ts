'use strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { TreeIndex } from '../../../src/adapter/treeIndex'
import {
  createTreeIndexes,
  type TreeIndexes,
} from '../../../src/adapter/treeIndexes'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import IncludeProcessor from '../../../src/post-processor/includeProcessor'
import type { Config } from '../../../src/types/config'
import ChangeSet from '../../../src/utils/changeSet'
import { IgnoreHelper } from '../../../src/utils/ignoreHelper'
import { MetadataElement } from '../../../src/utils/metadataElement'
import {
  buildMetadataFixtureRepo,
  EXISTING_RESOURCE_FILE,
  type MetadataFixtureRefs,
  NEW_RESOURCE_FILE,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'
import { getContext } from '../../__utils__/testWork'

// Characterizes IncludeProcessor.transformAndCollect end-to-end, against a
// real fixture repo and a real GitAdapter (no adapter mocks). This locks in
// today's output as the reference the pool-key rebind (GitAdapter keyed by
// repo instead of by repo+to) must reproduce byte-for-byte.
//
// generateDelta is left off in most cases: it only toggles whether copy
// operations are additionally collected (an orthogonal concern to which
// tree index resolves a boundary), and turning it on adds copy-path noise
// that isn't what this suite is pinning down. The tree index is still
// built by hand here (buildTreeIndexesForTo), mirroring the precondition
// main.ts establishes before it runs the include pass in a
// --generate-delta invocation.
//
// The 'generateDelta: true' case below is the exception: it exists
// specifically to pin the DELETION pass's metadata-boundary resolution (see
// MetadataBoundaryResolver.scanAndCreateElement), which none of the
// generateDelta-off cases reach deep enough to exercise.

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
  from: refs.root,
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

// Builds the run-owned holder the way main.ts does for config.to, mirroring
// the precondition main.ts establishes before it runs the include pass in a
// --generate-delta invocation.
const buildTreeIndexesForTo = async (config: Config): Promise<TreeIndexes> => {
  const gitAdapter = GitAdapter.getInstance(config)
  const index = await gitAdapter.buildTreeIndex(config.to, config.source)
  return createTreeIndexes(new Map<string, TreeIndex>([[config.to, index!]]))
}

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
      const treeIndexes = await buildTreeIndexesForTo(config)
      const sut = new IncludeProcessor(
        getContext({ config, metadata, trees: treeIndexes })
      )

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
      const treeIndexes = await buildTreeIndexesForTo(config)
      const sut = new IncludeProcessor(
        getContext({ config, metadata, trees: treeIndexes })
      )

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
      const treeIndexes = await buildTreeIndexesForTo(config)
      const sut = new IncludeProcessor(
        getContext({ config, metadata, trees: treeIndexes })
      )

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

  describe('When --include-destructive forces a nested resource file onto the DELETION pass under generateDelta: true', () => {
    it('Then the metadata boundary resolves against the populated config.to tree index, not the unindexed first commit', async () => {
      // Arrange — EXISTING_RESOURCE_FILE is nested two levels below its type
      // directory (bundle/subfolder/file), so createElement cannot resolve it
      // via a plain fromPath lookup and must fall into
      // MetadataBoundaryResolver.scanAndCreateElement. The DELETION pass
      // (includeProcessor.ts) runs that resolution with `revision` pinned to
      // the ORIGINAL config.to (typeHandlerFactory picks config.from for a
      // DELETION line, and the DELETION pass's own {from, to} override sets
      // effective `from` to the original config.to) — the exact revision
      // main.ts (and the buildTreeIndexesForTo call below) builds.
      const includeDestructivePath = await writeIncludePatterns(
        'include-generate-delta-deletion.txt',
        [EXISTING_RESOURCE_FILE]
      )
      const config = makeConfig({
        includeDestructive: includeDestructivePath,
        generateDelta: true,
      })
      const treeIndexes = await buildTreeIndexesForTo(config)
      const sut = new IncludeProcessor(
        getContext({ config, metadata, trees: treeIndexes })
      )
      const fromScanSpy = vi.spyOn(MetadataElement, 'fromScan')

      // Act
      const actual = await sut.transformAndCollect(ChangeSet.from([]))

      // Assert — the scan found ExistingResource's meta sibling in the
      // pre-built index and anchored the boundary at the bundle folder, not
      // at the file itself (the fallback a miss would have produced).
      const resolvedElement = fromScanSpy.mock.results.at(-1)
        ?.value as MetadataElement
      expect(resolvedElement.componentPath).toBe(
        'force-app/main/default/staticresources/ExistingResource'
      )
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
      fromScanSpy.mockRestore()
    })
  })
})
