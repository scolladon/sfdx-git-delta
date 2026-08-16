'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'
import ConfigValidator from '../../../src/utils/configValidator'
import {
  buildFixtureRepo,
  type FixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir, runGitText } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// The NUTs for --merge-base (delta.nut.ts) only prove oclif accepts the
// flag: they run it against HEAD~2..HEAD, and merge-base(HEAD~2, HEAD) is
// HEAD~2 itself on any first-parent-reachable ancestor, so `this.config.from
// = base` could be deleted from configValidator.ts and those NUTs would
// still pass. This test is the one that actually proves the feature: two
// commits that share an ancestor but neither of which is an ancestor of the
// other, so the resolved merge base is a real third commit, distinct from
// both refs the caller passed in.

let fixtureDir: string
let refs: FixtureRefs
// A sibling commit to refs.head's line, forked from refs.diffTo with the
// same tree (content is irrelevant — only the graph shape matters here).
// refs.head and this commit share refs.diffTo as their nearest common
// ancestor, and neither is reachable from the other.
let divergentCommit: string
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const makeConfig = (overrides: Partial<Config>): Config => ({
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
  fixtureDir = await trackedTempDir('sgd-merge-base-fixture-')
  refs = buildFixtureRepo(fixtureDir)
  const forkTreeOid = runGitText(['rev-parse', `${refs.diffTo}^{tree}`], {
    cwd: fixtureDir,
  })
  divergentCommit = runGitText(
    ['commit-tree', forkTreeOid, '-p', refs.diffTo, '-m', 'divergent branch'],
    { cwd: fixtureDir }
  )
})

afterEach(async () => {
  // GitAdapter instances are cached per (repo, to): closing after every
  // test forces the next getInstance() to rebuild from the config that
  // test actually passed in.
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a real ConfigValidator wired to a real GitAdapter against a genuinely divergent history', () => {
  describe('When --merge-base resolves two commits whose only common ancestor is their fork point', () => {
    it('Then config.from becomes the fork point, not the ref the caller passed as --from', async () => {
      // Arrange — refs.head and divergentCommit both descend from
      // refs.diffTo, and neither is an ancestor of the other, so the merge
      // base is genuinely refs.diffTo, not a no-op echo of either input.
      const config = makeConfig({
        from: refs.head,
        to: divergentCommit,
        mergeBase: true,
      })
      const sut = new ConfigValidator(config)

      // Act
      await sut.validateConfig()

      // Assert — this is the assertion the flag-acceptance NUTs cannot
      // make: it fails if `this.config.from = base` is ever deleted from
      // configValidator.ts, because config.from would stay at refs.head.
      expect(config.from).toBe(refs.diffTo)
      expect(config.from).not.toBe(refs.head)
    })
  })
})
