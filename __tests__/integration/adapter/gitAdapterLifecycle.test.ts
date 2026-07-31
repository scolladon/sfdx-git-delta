'use strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  buildFixtureRepo,
  type FixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'

// Resolved relative to this file's own URL, never process.cwd(): the
// spawned CLI must be locatable regardless of which directory the test
// runner itself was launched from.
const CLI_ENTRY = fileURLToPath(new URL('../../../bin/run.js', import.meta.url))
const DEP0137_MARKER = 'DEP0137'

let fixtureDir: string
let refs: FixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-lifecycle-fixture-')
  refs = buildFixtureRepo(fixtureDir)
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given the built sfdx-git-delta CLI', () => {
  describe('When generating a delta manifest end-to-end', () => {
    it('Then the process exits clean with no dangling FileHandle warning', async () => {
      // Arrange: two real refs from a self-contained fixture — never the
      // outer checkout's own history, which CI may fetch at depth 1.
      const outputDir = await trackedTempDir('sgd-lifecycle-output-')

      // Act
      const sut = spawnSync(
        process.execPath,
        [
          CLI_ENTRY,
          'sgd',
          'source',
          'delta',
          '--from',
          refs.diffFrom,
          '--to',
          refs.diffTo,
          '--repo-dir',
          fixtureDir,
          '--output-dir',
          outputDir,
        ],
        { cwd: fixtureDir, encoding: 'utf8' }
      )

      // Assert: a clean exit with no DEP0137 substring is the runtime
      // proof that `await GitAdapter.closeAll()` disposed the tsgit
      // pack FileHandle before the process attempted to exit.
      expect(sut.status).toBe(0)
      expect(sut.stderr).not.toContain(DEP0137_MARKER)
      expect(existsSync(join(outputDir, 'package'))).toBe(true)
    })
  })
})
