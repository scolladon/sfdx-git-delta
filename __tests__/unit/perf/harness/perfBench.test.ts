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
  assertScalesLinearly,
  deriveCeilingMs,
  GROWTH_TOLERANCE,
  MIN_SIZE_RATIO,
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

describe('Given assertScalesLinearly', () => {
  const rowOf = (samplesMs: readonly number[], label = 'expand-4k') => ({
    label,
    samplesMs,
  })
  const baselineOf = (samplesMs: readonly number[]) =>
    rowOf(samplesMs, 'expand-2k')

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -2, 0, 1.5])(
    'When the size ratio is %s, Then it throws naming the ratio',
    sizeRatio => {
      // Arrange
      const sut = assertScalesLinearly

      // Act
      const act = () => sut(baselineOf([10]), rowOf([20]), sizeRatio)

      // Assert
      expect(act).toThrow(
        `assertScalesLinearly requires a finite sizeRatio of at least 2; got ${sizeRatio}`
      )
    }
  )

  it('When no baseline samples were recorded, Then it throws naming the baseline row as absent from the run', () => {
    // Arrange
    const sut = assertScalesLinearly

    // Act
    const act = () => sut(baselineOf([]), rowOf([10]), 2)

    // Assert
    expect(act).toThrow(
      'expand-4k needs expand-2k in the same run, which recorded no samples (filtered out with -t?)'
    )
  })

  it('When no scaled samples were recorded, Then it throws naming the label', () => {
    // Arrange
    const sut = assertScalesLinearly

    // Act
    const act = () => sut(baselineOf([10]), rowOf([]), 2)

    // Assert
    expect(act).toThrow('expand-4k recorded no samples to compare')
  })

  it('When the fastest baseline sample took no time, Then it throws instead of passing an undefined growth', () => {
    // Arrange
    const sut = assertScalesLinearly

    // Act
    const act = () => sut(baselineOf([0]), rowOf([0]), 2)

    // Assert
    expect(act).toThrow(
      'expand-4k cannot be compared against expand-2k, whose fastest sample took no time'
    )
  })

  it('When the fastest samples grow beyond the linear bound, Then it throws naming the growth and the bound', () => {
    // Arrange
    const sut = assertScalesLinearly

    // Act
    const act = () => sut(baselineOf([10, 50]), rowOf([40, 90]), 2)

    // Assert
    expect(act).toThrow(
      'expand-4k grew 4.00x over expand-2k for a 2x larger input, exceeding the 3x linear-scaling bound'
    )
  })

  it('When the fastest samples grow linearly while slower ones do not, Then it does not throw', () => {
    // Arrange
    const sut = assertScalesLinearly

    // Act
    const act = () => sut(baselineOf([10, 50]), rowOf([20, 200]), 2)

    // Assert
    expect(act).not.toThrow()
  })

  it('When the fastest samples grow exactly to the bound, Then it does not throw', () => {
    // Arrange
    const sut = assertScalesLinearly

    // Act
    const act = () => sut(baselineOf([10]), rowOf([30]), 2)

    // Assert
    expect(act).not.toThrow()
  })
})

describe('Given MIN_SIZE_RATIO', () => {
  it('When read, Then it is 2', () => {
    // Arrange
    const sut = MIN_SIZE_RATIO

    // Assert
    expect(sut).toBe(2)
  })
})

describe('Given GROWTH_TOLERANCE', () => {
  it('When read, Then it is 1.5', () => {
    // Arrange
    const sut = GROWTH_TOLERANCE

    // Assert
    expect(sut).toBe(1.5)
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
