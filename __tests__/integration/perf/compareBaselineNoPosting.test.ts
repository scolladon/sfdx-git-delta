'use strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTempDir } from '../../__utils__/gitTestHarness'

// Resolved relative to this file's own URL, never process.cwd(): the
// spawned script must be locatable regardless of which directory the test
// runner itself was launched from.
const SCRIPT_ENTRY = fileURLToPath(
  new URL('../../perf/compareBaseline.mjs', import.meta.url)
)

const writeJson = (path: string, entries: unknown) =>
  writeFile(path, JSON.stringify(entries))

// A tiny ESM shim, written into the temp cwd at runtime, that traps every
// `fetch` call to a log file instead of hitting the network. It is loaded
// via `--import` before the script runs, so it adds no tracked file, no
// ls-lint surface and no knip entry point.
const FETCH_TRAP_SOURCE = `
import { appendFileSync } from 'node:fs'
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: async input => {
    appendFileSync(process.env.FETCH_TRAP_PATH, \`\${input}\\n\`)
    return { json: async () => [] }
  },
})
`

let cwd: string
let fetchTrapPath: string
let exitCode: number | null

beforeAll(async () => {
  cwd = await createTempDir('sgd-perf-no-posting-')
  fetchTrapPath = join(cwd, 'fetch-trap.log')

  // Arrange: minimal fixtures, one matching entry per series, mandatory
  // non-base files (the script throws when either is missing) plus the
  // optional base pair so the Stable section is non-empty content, not an
  // artifact of an empty comparison.
  await Promise.all([
    writeJson(join(cwd, 'perf-runtime.json'), [
      { name: 'a', unit: 'ops/sec', value: 100, range: '±1.00%' },
    ]),
    writeJson(join(cwd, 'perf-runtime-base.json'), [
      { name: 'a', unit: 'ops/sec', value: 100, range: '±1.00%' },
    ]),
    writeJson(join(cwd, 'perf-memory.json'), [
      { name: 'a', unit: 'ms', value: 10, range: '±1.00%' },
    ]),
    writeJson(join(cwd, 'perf-memory-base.json'), [
      { name: 'a', unit: 'ms', value: 10, range: '±1.00%' },
    ]),
    writeFile(join(cwd, 'fetchTrap.mjs'), FETCH_TRAP_SOURCE),
  ])

  // Act: spawn the real script with the fetch trap loaded first and the
  // three GitHub variables set to obviously fake values — a posting path
  // gated only by their presence would otherwise attempt a real call here.
  const sut = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(cwd, 'fetchTrap.mjs')).href, SCRIPT_ENTRY],
    {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_TOKEN: 'trap-token',
        GITHUB_REPOSITORY: 'trap-owner/trap-repo',
        PR_NUMBER: '1',
        FETCH_TRAP_PATH: fetchTrapPath,
      },
    }
  )
  exitCode = sut.status
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('Given the GitHub posting variables are set to fake but truthy values', () => {
  describe('When compareBaseline.mjs runs', () => {
    it('Then it makes no network call', () => {
      expect(existsSync(fetchTrapPath)).toBe(false)
    })

    it('Then it still exits 0', () => {
      expect(exitCode).toBe(0)
    })

    it('Then it still writes perf-comparison.md', async () => {
      const report = await readFile(join(cwd, 'perf-comparison.md'), 'utf-8')
      expect(report).toContain('# Performance Comparison (same runner)')
    })
  })
})
