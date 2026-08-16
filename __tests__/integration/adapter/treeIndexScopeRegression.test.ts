'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { TreeIndex } from '../../../src/adapter/treeIndex'
import { createTreeIndexes } from '../../../src/adapter/treeIndexes'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import type { Config } from '../../../src/types/config'
import type { Metadata } from '../../../src/types/metadata'
import { MetadataBoundaryResolver } from '../../../src/utils/metadataBoundaryResolver'
import { computeTreeIndexScope } from '../../../src/utils/treeIndexScope'
import {
  buildMetadataFixtureRepo,
  type MetadataFixtureRefs,
  NEW_RESOURCE_FILE,
  NEW_RESOURCE_META,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// Standing invariant: main.ts (src/main.ts) builds exactly one TreeIndex per
// revision, scoped to the DIFF-COMPUTED scope (computeTreeIndexScope)
// whenever --generate-delta runs without --include/--include-destructive,
// and hands that single index directly to every reader (handlers,
// RenameResolver, IOExecutor, post-processors). No reader recomputes its
// own scope or rebuilds its own index, so a reader can never see a scope
// different from the one this index was built under. A nested resource
// (e.g. a StaticResource file two levels below its type directory) must
// resolve to its bundle root against that shared index, not fall back to
// its last path segment.
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
    })
  })
})
