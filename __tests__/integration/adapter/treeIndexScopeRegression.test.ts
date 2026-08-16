'use strict'
import { rm } from 'node:fs/promises'

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
import { createTreeIndexes } from '../../../src/adapter/gitTreeLister'
import type { TreeIndex } from '../../../src/adapter/treeIndex'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import type { Config } from '../../../src/types/config'
import type { Metadata } from '../../../src/types/metadata'
import { MetadataBoundaryResolver } from '../../../src/utils/metadataBoundaryResolver'
import { MetadataElement } from '../../../src/utils/metadataElement'
import { computeTreeIndexScope } from '../../../src/utils/treeIndexScope'
import {
  buildMetadataFixtureRepo,
  type MetadataFixtureRefs,
  NEW_RESOURCE_FILE,
  NEW_RESOURCE_META,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// Regression coverage for the bug this commit fixed: main.ts (src/main.ts)
// pre-builds the tree index under the DIFF-COMPUTED scope
// (computeTreeIndexScope) whenever --generate-delta runs without
// --include/--include-destructive. Before this commit, every reader
// rebuilt its own TreeScope via treeScopeAt(config, revision), which
// hardcoded scopePaths: config.source — with the default `--source-dir
// './'`, config.source resolved to the whole-repo (root) scope while the
// pre-built index was keyed under the narrower diff-computed scope, so the
// lookup missed. Caller ownership (this commit) removes the possibility of
// that mismatch entirely: main.ts builds one TreeIndex per revision and
// hands it directly to every reader — there is no separate scope for a
// reader to recompute.
//
// NEW_RESOURCE_FILE is nested two levels below its type directory
// (staticresources/NewResource/images/photo.png), so resolving its member
// name requires MetadataBoundaryResolver.scanAndCreateElement to call
// getFilesPath against the pre-built index. A scope-key miss (the old bug)
// makes that call return [], and resolution falls back to the last path
// segment ('photo') instead of anchoring at the bundle root ('NewResource').

let fixtureDir: string
let refs: MetadataFixtureRefs
let metadata: MetadataRepository
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const staticResourceType: Metadata = {
  directoryName: 'staticresources',
  inFolder: false,
  metaFile: true,
  suffix: 'resource',
  xmlName: 'StaticResource',
  adapter: 'mixedContent',
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-scope-regression-fixture-')
  refs = buildMetadataFixtureRepo(fixtureDir)
  metadata = await getDefinition({})
})

afterEach(async () => {
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given main.ts pre-builds the tree index under the diff-computed scope (ordinary --generate-delta run)', () => {
  describe('When a reader resolves a nested StaticResource file with the default (root) source scope', () => {
    it('Then it still anchors at the bundle root, not the last path segment', async () => {
      // Arrange — mirrors main.ts's needsScopeFromDiff branch exactly:
      // generateDelta on, no --include/--include-destructive, so the
      // pre-build scope is computeTreeIndexScope's diff-derived set.
      const config: Config = {
        to: refs.head,
        from: refs.root,
        mergeBase: false,
        output: '',
        source: sourceDirs('./'),
        repo: fixtureDir,
        ignoreWhitespace: false,
        generateDelta: true,
      }
      const lines = [`A\t${NEW_RESOURCE_FILE}`, `A\t${NEW_RESOURCE_META}`]
      const scopePaths = [...computeTreeIndexScope(lines, metadata)]
      const gitAdapter = GitAdapter.getInstance(config)
      const index = await gitAdapter.buildTreeIndex(config.to, scopePaths)
      const treeIndexes = createTreeIndexes(
        new Map<string, TreeIndex>([[config.to, index!]])
      )

      const resolver = new MetadataBoundaryResolver(metadata, treeIndexes)
      const fromScanSpy = vi.spyOn(MetadataElement, 'fromScan')

      // Act
      const element = await resolver.createElement(
        NEW_RESOURCE_FILE,
        staticResourceType,
        config.to
      )

      // Assert — real data: componentPath anchors at the bundle root, not
      // a fallback produced by an empty getFilesPath result.
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/NewResource'
      )
      fromScanSpy.mockRestore()
    })
  })
})
