'use strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()
const CLI_ENTRY = join(REPO_ROOT, 'bin', 'run.js')
const DEP0137_MARKER = 'DEP0137'

describe('Given the built sfdx-git-delta CLI', () => {
  describe('When generating a delta manifest end-to-end', () => {
    it('Then the process exits clean with no dangling FileHandle warning', async () => {
      // Arrange
      const outputDir = await mkdtemp(join(tmpdir(), 'sgd-lifecycle-'))

      try {
        // Act
        const sut = spawnSync(
          process.execPath,
          [
            CLI_ENTRY,
            'sgd',
            'source',
            'delta',
            '--from',
            'HEAD~5',
            '--to',
            'HEAD',
            '--repo-dir',
            REPO_ROOT,
            '--output-dir',
            outputDir,
          ],
          { cwd: REPO_ROOT, encoding: 'utf8' }
        )

        // Assert: a clean exit with no DEP0137 substring is the runtime
        // proof that `await GitAdapter.closeAll()` disposed the tsgit
        // pack FileHandle before the process attempted to exit.
        expect(sut.status).toBe(0)
        expect(sut.stderr).not.toContain(DEP0137_MARKER)
        expect(existsSync(join(outputDir, 'package'))).toBe(true)
      } finally {
        await rm(outputDir, { recursive: true, force: true })
      }
    })
  })
})
