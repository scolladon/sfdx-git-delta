'use strict'
import { spawnSync } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTempDir } from '../../__utils__/gitTestHarness'
import {
  COMPARE_BASELINE_ENTRY,
  writeJson,
} from '../../__utils__/perfScriptHarness'

let cwd: string
let report: string
let stdout: string
let exitCode: number | null

const runtimeRow = (name: string, value: number) => ({
  name,
  unit: 'ops/sec',
  value,
  range: '±1.00%',
})
const memoryRow = (name: string, value: number) => ({
  name,
  unit: 'ms',
  value,
  range: '±1.00%',
})

beforeAll(async () => {
  cwd = await createTempDir('sgd-perf-zero-value-')

  // Arrange: every side that can be zero, in both series, plus one genuine
  // regression proving classification still runs in the same report.
  await Promise.all([
    writeJson(join(cwd, 'perf-runtime-base.json'), [
      runtimeRow('zero-base', 0),
      runtimeRow('zero-pr', 100),
      runtimeRow('zero-both', 0),
    ]),
    writeJson(join(cwd, 'perf-runtime.json'), [
      runtimeRow('zero-base', 100),
      runtimeRow('zero-pr', 0),
      runtimeRow('zero-both', 0),
    ]),
    writeJson(join(cwd, 'perf-memory-base.json'), [
      memoryRow('zero-base', 0),
      memoryRow('zero-pr', 10),
      memoryRow('zero-both', 0),
      memoryRow('regressed', 10),
    ]),
    writeJson(join(cwd, 'perf-memory.json'), [
      memoryRow('zero-base', 10),
      memoryRow('zero-pr', 0),
      memoryRow('zero-both', 0),
      memoryRow('regressed', 20),
    ]),
  ])

  // Act
  const sut = spawnSync(process.execPath, [COMPARE_BASELINE_ENTRY], {
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

const section = (title: string) =>
  report.split(`## ${title}`)[1]?.split('##')[0] ?? ''

describe('Given a comparison where a benchmark value rounded to zero', () => {
  describe('When the base value is zero', () => {
    it('Then the runtime row renders n/a under Stable', () => {
      expect(section('Stable')).toContain('| zero-base | 0 | 100 | n/a | n/a |')
    })

    it('Then the memory row renders n/a under Stable', () => {
      expect(section('Stable')).toContain(
        '| zero-base (mean) | 0ms | 10ms | n/a | n/a |'
      )
    })
  })

  describe('When the PR value is zero', () => {
    it('Then the runtime row renders n/a under Stable', () => {
      expect(section('Stable')).toContain('| zero-pr | 100 | 0 | n/a | n/a |')
    })

    it('Then the memory row renders n/a under Stable', () => {
      expect(section('Stable')).toContain(
        '| zero-pr (mean) | 10ms | 0ms | n/a | n/a |'
      )
    })
  })

  describe('When both values are zero', () => {
    it('Then the runtime row renders n/a instead of NaN', () => {
      expect(section('Stable')).toContain('| zero-both | 0 | 0 | n/a | n/a |')
    })

    it('Then the memory row renders n/a instead of NaN', () => {
      expect(section('Stable')).toContain(
        '| zero-both (mean) | 0ms | 0ms | n/a | n/a |'
      )
    })
  })

  describe('When the rows are classified', () => {
    it('Then no zero-valued row is listed as a regression or an improvement', () => {
      expect(section('Regressions')).not.toContain('zero-')
      expect(section('Improvements')).not.toContain('zero-')
    })

    it('Then no ratio renders as NaN, Infinity or -100%', () => {
      expect(report).not.toMatch(/NaN|Infinity|-100%/)
    })

    it('Then a non-zero regression is still listed under Regressions', () => {
      expect(section('Regressions')).toContain(
        '| regressed (mean) | 10ms | 20ms | 2.00 | +100.0% |'
      )
    })

    it('Then the regression warning counts only the non-zero row', () => {
      expect(stdout).toContain(
        '::warning::1 performance regression(s) detected'
      )
    })

    it('Then the script still exits 0, staying advisory', () => {
      expect(exitCode).toBe(0)
    })
  })
})
