'use strict'
import { spawnSync } from 'node:child_process'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

let cwd: string
let report: string
let stdout: string
let exitCode: number | null

beforeAll(async () => {
  cwd = await createTempDir('sgd-perf-reconciliation-')

  // Arrange: two series (runtime, memory) each carrying a renamed bench
  // (b -> b-renamed), a deleted bench (c), a new bench (d), a stable bench
  // (a), and a bench (e) that is stable in runtime but absent from the PR
  // memory file only — a partial run disagreeing between the two series.
  await Promise.all([
    writeJson(join(cwd, 'perf-runtime-base.json'), [
      { name: 'a', unit: 'ops/sec', value: 100, range: '±1.00%' },
      { name: 'b', unit: 'ops/sec', value: 100, range: '±1.00%' },
      { name: 'c', unit: 'ops/sec', value: 100, range: '±1.00%' },
      { name: 'e', unit: 'ops/sec', value: 100, range: '±1.00%' },
    ]),
    writeJson(join(cwd, 'perf-runtime.json'), [
      { name: 'a', unit: 'ops/sec', value: 100, range: '±1.00%' },
      { name: 'b-renamed', unit: 'ops/sec', value: 100, range: '±1.00%' },
      { name: 'd', unit: 'ops/sec', value: 100, range: '±1.00%' },
      { name: 'e', unit: 'ops/sec', value: 100, range: '±1.00%' },
    ]),
    writeJson(join(cwd, 'perf-memory-base.json'), [
      { name: 'a', unit: 'ms', value: 10, range: '±1.00%' },
      { name: 'b', unit: 'ms', value: 10, range: '±1.00%' },
      { name: 'c', unit: 'ms', value: 10, range: '±1.00%' },
      { name: 'e', unit: 'ms', value: 10, range: '±1.00%' },
    ]),
    writeJson(join(cwd, 'perf-memory.json'), [
      { name: 'a', unit: 'ms', value: 10, range: '±1.00%' },
      { name: 'b-renamed', unit: 'ms', value: 10, range: '±1.00%' },
      { name: 'd', unit: 'ms', value: 10, range: '±1.00%' },
    ]),
  ])

  // Act: spawn the real script. It makes no network call by construction —
  // it no longer reads GITHUB_TOKEN, GITHUB_REPOSITORY or PR_NUMBER at all —
  // so the inherited environment needs no stripping.
  const sut = spawnSync(process.execPath, [SCRIPT_ENTRY], {
    cwd,
    encoding: 'utf8',
  })
  exitCode = sut.status

  stdout = sut.stdout
  report = await readFile(join(cwd, 'perf-comparison.md'), 'utf-8')
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const missingSection = () =>
  report.split('## Benchmarks missing from this run')[1]?.split('##')[0] ?? ''
const newSection = () =>
  report.split('## Benchmarks new in this run')[1]?.split('##')[0] ?? ''
const stableSection = () => report.split('## Stable')[1]?.split('##')[0] ?? ''

describe('Given a PR run reconciled against a base run', () => {
  describe('When a benchmark was renamed between base and PR', () => {
    it('Then its old name is reported missing in both series', () => {
      expect(missingSection()).toContain('| b | runtime | 100 |')
      expect(missingSection()).toContain('| b | memory | 10ms |')
    })

    it('Then its new name is reported new in both series', () => {
      expect(newSection()).toContain('| b-renamed | runtime | 100 |')
      expect(newSection()).toContain('| b-renamed | memory | 10ms |')
    })
  })

  describe('When a benchmark was deleted from the PR run', () => {
    it('Then it is reported missing in both series and never as new', () => {
      expect(missingSection()).toContain('| c | runtime | 100 |')
      expect(missingSection()).toContain('| c | memory | 10ms |')
      expect(newSection()).not.toContain('| c |')
    })
  })

  describe('When a benchmark exists only in the PR run', () => {
    it('Then it is reported new in both series and never as missing', () => {
      expect(newSection()).toContain('| d | runtime | 100 |')
      expect(newSection()).toContain('| d | memory | 10ms |')
      expect(missingSection()).not.toContain('| d |')
    })
  })

  describe('When a benchmark is unchanged between base and PR', () => {
    it('Then it stays under Stable and is never reported missing or new', () => {
      expect(stableSection()).toContain('| a | 100 | 100 |')
      expect(stableSection()).toContain('| a (mean) | 10ms | 10ms |')
      expect(missingSection()).not.toContain('| a |')
      expect(newSection()).not.toContain('| a |')
    })
  })

  describe('When a benchmark is present in both runtime files but absent from the PR memory file only', () => {
    it('Then it stays Stable under runtime and is reported missing under memory alone', () => {
      expect(stableSection()).toContain('| e | 100 | 100 |')
      expect(missingSection()).toContain('| e | memory | 10ms |')
      expect(missingSection()).not.toContain('| e | runtime |')
    })
  })

  describe('When the run contains reconciliation rows to report', () => {
    it('Then the script still exits 0, staying advisory', () => {
      expect(exitCode).toBe(0)
    })

    // The annotation counts benchmark NAMES, while the tables above count
    // (name, series) rows: b and c are missing from both series and e from
    // memory alone, so the rows number five and the names three. Without the
    // dedupe the annotation would double-count, and nothing else here would
    // notice.
    it('Then the missing annotation counts names once, not once per series', () => {
      expect(stdout).toContain(
        '::warning::3 benchmark(s) missing from this run: b, c, e'
      )
    })

    it('Then the new-benchmark annotation is a notice, counted the same way', () => {
      expect(stdout).toContain(
        '::notice::2 new benchmark(s) in this run: b-renamed, d'
      )
    })
  })
})
