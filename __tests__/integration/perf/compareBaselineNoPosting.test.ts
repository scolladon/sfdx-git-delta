'use strict'
import { spawnSync } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTempDir } from '../../__utils__/gitTestHarness'
import {
  COMPARE_BASELINE_ENTRY,
  writeJson,
} from '../../__utils__/perfScriptHarness'

// A tiny ESM shim, written into the temp cwd at runtime, that traps every
// `fetch` call to a log file instead of hitting the network. It is loaded
// via `--import` before the script runs, so it adds no tracked file, no
// ls-lint surface and no knip entry point.
//
// It writes ARMED_MARKER the moment it loads. Asserting the absence of a log
// file would pass just as readily when the shim never loaded at all, so the
// marker is what makes "no call was made" distinguishable from "nothing was
// watching".
const ARMED_MARKER = 'trap-armed'
const FETCH_TRAP_SOURCE = `
import { appendFileSync } from 'node:fs'
appendFileSync(process.env.FETCH_TRAP_PATH, '${ARMED_MARKER}\\n')
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: async input => {
    appendFileSync(process.env.FETCH_TRAP_PATH, \`fetch \${input}\\n\`)
    return { json: async () => [] }
  },
})
`

let cwd: string
let fetchTrapPath: string
let exitCode: number | null
let trapLog: string

beforeAll(async () => {
  cwd = await createTempDir('sgd-perf-no-posting-')
  fetchTrapPath = join(cwd, 'fetch-trap.log')

  // Arrange: minimal fixtures, one matching entry per series, mandatory
  // non-base files (the script throws when either is missing) plus the
  // optional base pair, which the Stable-section assertion below reads.
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
    [
      '--import',
      pathToFileURL(join(cwd, 'fetchTrap.mjs')).href,
      COMPARE_BASELINE_ENTRY,
    ],
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
  trapLog = await readFile(fetchTrapPath, 'utf-8')
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('Given the GitHub posting variables are set to fake but truthy values', () => {
  describe('When compareBaseline.mjs runs', () => {
    it('Then the fetch trap was armed', () => {
      expect(trapLog).toContain(ARMED_MARKER)
    })

    it('Then it makes no fetch call', () => {
      expect(trapLog).not.toContain('fetch ')
    })

    // The trap only replaces globalThis.fetch, so it cannot see a posting
    // path rebuilt on node:https or a spawned `gh`. Every such path needs a
    // credential, so the source is asserted to name none — that is what makes
    // this a guard against reintroduction rather than against one library.
    it('Then the script reads no GitHub credential', async () => {
      const source = await readFile(COMPARE_BASELINE_ENTRY, 'utf-8')
      expect(source).not.toMatch(/GITHUB_TOKEN|GITHUB_REPOSITORY|PR_NUMBER/)
    })

    it('Then it still exits 0', () => {
      expect(exitCode).toBe(0)
    })

    it('Then it still writes perf-comparison.md', async () => {
      const report = await readFile(join(cwd, 'perf-comparison.md'), 'utf-8')
      expect(report).toContain('# Performance Comparison (same runner)')
    })

    it('Then the base pair produces a stable row', async () => {
      const report = await readFile(join(cwd, 'perf-comparison.md'), 'utf-8')
      expect(report).toContain('| a | 100 | 100 | 1.00 |')
    })
  })
})
