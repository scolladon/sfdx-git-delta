'use strict'
import { describe, expect, it, vi } from 'vitest'

const { mockTest } = vi.hoisted(() => ({
  mockTest: vi.fn(),
}))

vi.mock('vitest', async () => {
  const actual: typeof import('vitest') = await vi.importActual('vitest')
  return { ...actual, test: mockTest }
})

import type { PerfBenchHooks } from '../../../perf/harness/perfBench'
import {
  assertMeanWithinCeiling,
  deriveCeilingMs,
  perfBench,
  RUNNER_NOISE_FACTOR,
} from '../../../perf/harness/perfBench'

const RUN_OPTIONS = {
  time: 1000,
  iterations: 64,
  warmupTime: 250,
  warmupIterations: 16,
} as const

// perfBench registers its work through vitest's own `test()`, which is
// mocked above so this suite can invoke the captured callback directly
// against a bench double — exercising perfBench's own branching without
// paying for a real tinybench run.
const invokeRegisteredCallback = async (run: ReturnType<typeof vi.fn>) => {
  const callback = mockTest.mock.calls.at(-1)?.[1] as (ctx: {
    bench: ReturnType<typeof vi.fn>
  }) => Promise<void>
  const mockBench = vi.fn().mockReturnValue({ run })
  await callback({ bench: mockBench })
  return mockBench
}

describe('Given perfBench', () => {
  it('When hooks is passed as a bare function, Then it throws before registering a test', () => {
    // Arrange
    const sut = perfBench
    const legacyPositionalAfterRun = (() =>
      undefined) as unknown as PerfBenchHooks

    // Act
    const act = () =>
      sut('legacy-call-site', () => undefined, legacyPositionalAfterRun)

    // Assert
    expect(act).toThrow(/function as its third argument/)
    expect(mockTest).not.toHaveBeenCalled()
  })

  it('When called without hooks, Then the registered test runs bench with the two-argument overload', async () => {
    // Arrange
    const sut = perfBench
    const fn = vi.fn()
    const run = vi.fn().mockResolvedValue(undefined)

    // Act
    sut('no-hooks-bench', fn)
    const mockBench = await invokeRegisteredCallback(run)

    // Assert
    expect(mockBench).toHaveBeenCalledWith('no-hooks-bench', fn)
    expect(run).toHaveBeenCalledWith(RUN_OPTIONS)
  })

  it('When called with a beforeEach hook, Then the registered test runs bench with the three-argument overload', async () => {
    // Arrange
    const sut = perfBench
    const fn = vi.fn()
    const beforeEach = vi.fn()
    const run = vi.fn().mockResolvedValue(undefined)

    // Act
    sut('before-each-bench', fn, { beforeEach })
    const mockBench = await invokeRegisteredCallback(run)

    // Assert
    expect(mockBench).toHaveBeenCalledWith(
      'before-each-bench',
      { beforeEach },
      fn
    )
  })

  it('When called with an afterRun hook, Then it is invoked once the run resolves', async () => {
    // Arrange
    const sut = perfBench
    const fn = vi.fn()
    const afterRun = vi.fn()
    const run = vi.fn().mockResolvedValue(undefined)

    // Act
    sut('after-run-bench', fn, { afterRun })
    await invokeRegisteredCallback(run)

    // Assert
    expect(afterRun).toHaveBeenCalledOnce()
  })

  it('When called without an afterRun hook, Then the run resolves without error', async () => {
    // Arrange
    const sut = perfBench
    const fn = vi.fn()
    const run = vi.fn().mockResolvedValue(undefined)
    sut('no-after-run-bench', fn)

    // Act
    const act = () => invokeRegisteredCallback(run)

    // Assert
    await expect(act()).resolves.toBeDefined()
  })
})

describe('Given deriveCeilingMs', () => {
  it.each([
    [0.5614, 1.7],
    [1.6279, 4.9],
    [0.0214, 0.065],
    [6.312, 19],
    [9.61, 29],
    [53.0036, 160],
    [10 / 3, 10],
    [0.033, 0.099],
  ])(
    'When the worst mean is %fms, Then the ceiling rounds up to two significant figures of the noise-scaled value (%fms)',
    (worstMeanMs, expected) => {
      // Arrange
      const sut = deriveCeilingMs

      // Act
      const result = sut(worstMeanMs)

      // Assert
      expect(result).toBe(expected)
    }
  )

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])(
    'When the worst mean is %s, Then it throws instead of returning a vacuous ceiling',
    (_label, worstMeanMs) => {
      // Arrange
      const sut = deriveCeilingMs

      // Act
      const act = () => sut(worstMeanMs)

      // Assert
      expect(act).toThrow(/worstMeanMs/)
    }
  )
})

describe('Given assertMeanWithinCeiling', () => {
  it('When no samples were recorded, Then it throws naming the label', () => {
    // Arrange
    const sut = assertMeanWithinCeiling

    // Act
    const act = () => sut('resolveCommit', [], 10)

    // Assert
    expect(act).toThrow(
      'resolveCommit recorded no samples to check against its ceiling'
    )
  })

  it('When the mean exceeds the ceiling, Then it throws naming the mean and the ceiling', () => {
    // Arrange
    const sut = assertMeanWithinCeiling

    // Act
    const act = () => sut('resolveCommit', [10, 20], 10)

    // Assert
    expect(act).toThrow(
      'resolveCommit averaged 15.00ms over 2 samples, exceeding the 10ms noise-tolerant ceiling'
    )
  })

  it('When the mean is within the ceiling, Then it does not throw', () => {
    // Arrange
    const sut = assertMeanWithinCeiling

    // Act
    const act = () => sut('resolveCommit', [5, 5], 10)

    // Assert
    expect(act).not.toThrow()
  })
})

describe('Given RUNNER_NOISE_FACTOR', () => {
  it('When read, Then it is 3', () => {
    // Arrange
    const sut = RUNNER_NOISE_FACTOR

    // Assert
    expect(sut).toBe(3)
  })
})
