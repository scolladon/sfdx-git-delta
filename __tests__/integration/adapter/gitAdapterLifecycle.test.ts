'use strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
      // pack FileHandle before the process attempted to exit. The stream
      // outputs ride along in the compared object so a non-zero exit
      // reports WHY it failed, not just the code.
      expect({
        status: sut.status,
        stdout: sut.stdout,
        stderr: sut.stderr,
      }).toMatchObject({
        status: 0,
        stderr: expect.not.stringContaining(DEP0137_MARKER),
      })
      expect(existsSync(join(outputDir, 'package'))).toBe(true)
    })

    it('Then a --source-dir with a trailing slash produces a manifest carrying members', async () => {
      // Arrange — a folder-looking source-dir value that must canonicalise
      // to a literal directory pathspec, not a no-op glob.
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
          '--source-dir',
          'src/',
        ],
        { cwd: fixtureDir, encoding: 'utf8' }
      )

      // Assert
      expect({
        status: sut.status,
        stdout: sut.stdout,
        stderr: sut.stderr,
      }).toMatchObject({ status: 0 })
      const packageXml = readFileSync(
        join(outputDir, 'package', 'package.xml'),
        'utf8'
      )
      expect(packageXml).toContain('<members>')
      expect(packageXml).toContain('FixtureClass')
    })

    it('Then a --source-dir containing a wildcard is rejected with a non-zero exit', async () => {
      // Arrange
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
          '--source-dir',
          'src/**',
        ],
        { cwd: fixtureDir, encoding: 'utf8' }
      )

      // Assert — oclif's spinner picks stdout or stderr for the final
      // message; check the combined stream, not one specific one.
      expect(sut.status).not.toBe(0)
      const combined = sut.stdout + sut.stderr
      expect(combined).toContain('src/**')
      expect(combined).toContain('wildcard')
    })

    it('Then the unmatched-scope warning reports the rev the user typed, not its resolved SHA', async () => {
      // Arrange — '--to HEAD' is symbolic; refs.head is what it resolves
      // to. 'does-not-exist' matches nothing changed since refs.diffTo.
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
          refs.diffTo,
          '--to',
          'HEAD',
          '--repo-dir',
          fixtureDir,
          '--output-dir',
          outputDir,
          '--source-dir',
          'does-not-exist',
        ],
        { cwd: fixtureDir, encoding: 'utf8' }
      )

      // Assert
      const combined = sut.stdout + sut.stderr
      expect(combined).toContain('does-not-exist')
      expect(combined).toContain('HEAD')
      expect(combined).not.toContain(refs.head)
    })
  })
})
