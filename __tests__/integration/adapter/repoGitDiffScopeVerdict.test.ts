'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import type { Config } from '../../../src/types/config'
import RepoGitDiff from '../../../src/utils/repoGitDiff'
import {
  buildFixtureRepo,
  type FixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// Every other layer mocks the layer directly below it: repoGitDiff.test.ts
// mocks GitAdapter and hands back canned verdicts regardless of what
// RepoGitDiff actually threads through; GitAdapter.test.ts constructs its
// own verdicts directly. No test drives the real RepoGitDiff against the
// real GitAdapter, so a mutant that severs the diffScopeVerdict seam at
// either call site (the streamDiffLines call or the getUnmatchedSourceScopes
// call) is invisible everywhere else. This file closes that gap.

let fixtureDir: string
let refs: FixtureRefs
let globalMetadata: MetadataRepository
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const makeConfig = (source: Config['source']): Config => ({
  to: refs.diffTo,
  from: refs.diffFrom,
  output: '',
  source,
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
})

const drain = async (sut: RepoGitDiff): Promise<void> => {
  for await (const _line of sut.getLines()) {
    // Draining is the point — RepoGitDiff.getUnmatchedSourceScopes() only
    // reports a final verdict once the underlying async generator is
    // fully consumed.
  }
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-scope-verdict-fixture-')
  refs = buildFixtureRepo(fixtureDir)
  globalMetadata = await getDefinition({})
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

describe('Given a real RepoGitDiff wired to a real GitAdapter against a fixture repo', () => {
  describe('When a non-root source scope matches changes in the drained diff', () => {
    it('Then getUnmatchedSourceScopes reports no unmatched scopes', async () => {
      // Arrange — 'src' matches src/index.txt, src/lib/FixtureClass.cls,
      // src/lib/util.txt and src/lib/added.txt in the diffFrom..diffTo range.
      const config = makeConfig(sourceDirs('src'))
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      await drain(sut)
      const result = sut.getUnmatchedSourceScopes()

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('When a non-root source scope matches nothing in the drained diff', () => {
    it('Then getUnmatchedSourceScopes reports that scope as unmatched', async () => {
      // Arrange — the fixture repo has real changes between diffFrom and
      // diffTo, but none of them live under 'does-not-exist'.
      const config = makeConfig(sourceDirs('does-not-exist'))
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      await drain(sut)
      const result = sut.getUnmatchedSourceScopes()

      // Assert
      expect(result).toEqual(['does-not-exist'])
    })
  })
})
