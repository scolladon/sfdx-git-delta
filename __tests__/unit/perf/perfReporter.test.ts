'use strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TestCase, TestModule } from 'vitest/node'

import PerfReporter from '../../perf/perfReporter'

const { mockWriteFileSync } = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
}))

vi.mock('node:fs', async () => {
  const actual: typeof import('node:fs') = await vi.importActual('node:fs')
  return {
    ...actual,
    writeFileSync: mockWriteFileSync,
  }
})

const taskDouble = (name: string, mean: number, rme: number) => ({
  name,
  latency: { mean, rme },
  throughput: { mean: 0 },
  period: 0,
  totalTime: 0,
  rank: 1,
})

const testDouble = (
  name: string,
  state: 'passed' | 'failed' | 'skipped' | 'pending',
  tasks: ReturnType<typeof taskDouble>[]
) =>
  ({
    name,
    result: () => ({ state }),
    benchmarks: () =>
      tasks.length ? [{ name: `group > ${name}`, tasks }] : [],
  }) as unknown as TestCase

const multiBenchTestDouble = (
  name: string,
  benchmarks: ReturnType<typeof taskDouble>[][]
) =>
  ({
    name,
    result: () => ({ state: 'passed' }),
    benchmarks: () =>
      benchmarks.map((tasks, index) => ({ name: `group > ${index}`, tasks })),
  }) as unknown as TestCase

const moduleDouble = (relativeModuleId: string, tests: TestCase[]) =>
  ({
    relativeModuleId,
    children: { allTests: () => tests.values() },
  }) as unknown as TestModule

describe('Given a benchmark reporter', () => {
  let sut: PerfReporter

  beforeEach(() => {
    sut = new PerfReporter()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('When every test passed but the run carries an unhandled error, Then it throws and writes nothing', () => {
    // Arrange
    const task = taskDouble('only-bench', 2, 1)
    const testModule = moduleDouble('a.bench.ts', [
      testDouble('only-bench', 'passed', [task]),
    ])
    const unhandled = [new Error('worker crashed after the last test')]

    // Act
    const act = () => sut.onTestRunEnd([testModule], unhandled, 'passed')

    // Assert
    expect(act).toThrow(/unhandled error/i)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When a passed run carries one benchmark task, Then it writes runtime and latency entries computed from latency.mean and latency.rme', () => {
    // Arrange
    const task = taskDouble(
      'sample-bench',
      1.834881084249089,
      1.1354772624809373
    )
    const testCase = testDouble('carrier', 'passed', [task])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(mockWriteFileSync).toHaveBeenNthCalledWith(
      1,
      'perf-runtime.json',
      JSON.stringify(
        [
          {
            name: 'sample-bench',
            unit: 'ops/sec',
            value: 545,
            range: '±1.14%',
          },
        ],
        null,
        2
      )
    )
    expect(mockWriteFileSync).toHaveBeenNthCalledWith(
      2,
      'perf-memory.json',
      JSON.stringify(
        [{ name: 'sample-bench', unit: 'ms', value: 1.8349, range: '±1.14%' }],
        null,
        2
      )
    )
  })

  it('When a task has a sub-microsecond mean, Then ops/sec is rounded to the nearest integer and latency rounds to zero', () => {
    // Arrange
    const task = taskDouble('fast-bench', 0.000026, 0.0733)
    const testCase = testDouble('carrier', 'passed', [task])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(mockWriteFileSync).toHaveBeenNthCalledWith(
      1,
      'perf-runtime.json',
      JSON.stringify(
        [
          {
            name: 'fast-bench',
            unit: 'ops/sec',
            value: 38461538,
            range: '±0.07%',
          },
        ],
        null,
        2
      )
    )
    expect(mockWriteFileSync).toHaveBeenNthCalledWith(
      2,
      'perf-memory.json',
      JSON.stringify(
        [{ name: 'fast-bench', unit: 'ms', value: 0, range: '±0.07%' }],
        null,
        2
      )
    )
  })

  it('When modules run out of byte order, Then entries are written sorted by relativeModuleId with tasks kept in registration order', () => {
    // Arrange — names are chosen to contradict both orderings under test: a
    // reporter that sorted by task name, or that ignored module order, or that
    // reordered tasks within a module, each produces a different sequence.
    const cancellationKeyModule = moduleDouble(
      '__tests__/perf/cancellationKey.bench.ts',
      [
        testDouble('carrier-1', 'passed', [
          taskDouble('zz-first-registered', 1, 1),
        ]),
        testDouble('carrier-2', 'passed', [
          taskDouble('yy-second-registered', 1, 1),
        ]),
      ]
    )
    const xmlWriteModule = moduleDouble('__tests__/perf/xmlWrite.bench.ts', [
      testDouble('carrier-1', 'passed', [taskDouble('aa-later-module', 1, 1)]),
    ])

    // Act
    sut.onTestRunEnd([xmlWriteModule, cancellationKeyModule], [], 'passed')

    // Assert
    const expectedNames = [
      'zz-first-registered',
      'yy-second-registered',
      'aa-later-module',
    ]
    const runtimeWritten = JSON.parse(
      mockWriteFileSync.mock.calls[0]![1] as string
    ) as { name: string }[]
    const latencyWritten = JSON.parse(
      mockWriteFileSync.mock.calls[1]![1] as string
    ) as { name: string }[]
    expect(runtimeWritten.map(entry => entry.name)).toEqual(expectedNames)
    expect(latencyWritten.map(entry => entry.name)).toEqual(expectedNames)
  })

  it('When one test carries two benchmarks, Then tasks from both are written in benchmark order', () => {
    // Arrange
    const testCase = multiBenchTestDouble('carrier', [
      [taskDouble('first-benchmark-task', 1, 1)],
      [taskDouble('second-benchmark-task', 2, 1)],
    ])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    const runtimeWritten = JSON.parse(
      mockWriteFileSync.mock.calls[0]![1] as string
    ) as { name: string }[]
    expect(runtimeWritten.map(entry => entry.name)).toEqual([
      'first-benchmark-task',
      'second-benchmark-task',
    ])
  })

  it('When the run is interrupted, Then nothing is written and no error is thrown', () => {
    // Arrange
    const testCase = testDouble('carrier', 'passed', [
      taskDouble('sample-bench', 1, 1),
    ])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    const act = () => sut.onTestRunEnd([testModule], [], 'interrupted')

    // Assert
    expect(act).not.toThrow()
    expect(mockWriteFileSync).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith(
      'Benchmark run interrupted: perf-runtime.json and perf-memory.json not written'
    )
  })

  it('When one test failed and another passed test has zero tasks, Then it throws naming both in collection order and writes nothing', () => {
    // Arrange
    const failedTest = testDouble('failed-carrier', 'failed', [])
    const emptyTest = testDouble('empty-carrier', 'passed', [])
    const firstModule = moduleDouble('__tests__/perf/first.bench.ts', [
      failedTest,
    ])
    const secondModule = moduleDouble('__tests__/perf/second.bench.ts', [
      emptyTest,
    ])

    // Act
    const act = () =>
      sut.onTestRunEnd([firstModule, secondModule], [], 'failed')

    // Assert
    expect(act).toThrow(
      'Benchmarks produced no samples (body threw, never ran, or never called bench): failed-carrier, empty-carrier'
    )
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When a test is pending, Then it throws the no-samples error naming it', () => {
    // Arrange
    const pendingTest = testDouble('pending-carrier', 'pending', [])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      pendingTest,
    ])

    // Act
    const act = () => sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(act).toThrow(
      'Benchmarks produced no samples (body threw, never ran, or never called bench): pending-carrier'
    )
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When a skipped test sits next to a passed one, Then only the passed task is written and nothing throws', () => {
    // Arrange
    const skippedTest = testDouble('skipped-carrier', 'skipped', [])
    const passedTest = testDouble('passed-carrier', 'passed', [
      taskDouble('sample-bench', 1, 1),
    ])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      skippedTest,
      passedTest,
    ])

    // Act
    const act = () => sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(act).not.toThrow()
    const runtimeWritten = JSON.parse(
      mockWriteFileSync.mock.calls[0]![1] as string
    ) as { name: string }[]
    expect(runtimeWritten).toHaveLength(1)
    expect(runtimeWritten[0]!.name).toBe('sample-bench')
  })

  it('When every test passed with tasks but the run reason is failed, Then it throws a generic run error and writes nothing', () => {
    // Arrange
    const testCase = testDouble('carrier', 'passed', [
      taskDouble('sample-bench', 1, 1),
    ])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    const act = () => sut.onTestRunEnd([testModule], [], 'failed')

    // Assert
    expect(act).toThrow(
      'Benchmark run did not pass; perf-runtime.json and perf-memory.json not written'
    )
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When every test is skipped, Then it throws because no benchmark results were collected', () => {
    // Arrange
    const skippedTest = testDouble('skipped-carrier', 'skipped', [])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      skippedTest,
    ])

    // Act
    const act = () => sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(act).toThrow('No benchmark results collected; nothing written')
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When a task has an empty name, Then it throws and writes nothing', () => {
    // Arrange
    const testCase = testDouble('carrier', 'passed', [taskDouble('', 1, 1)])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    const act = () => sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(act).toThrow('Benchmark task names must be non-empty')
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When two tasks share a name across modules, Then it throws naming the duplicate once and writes nothing', () => {
    // Arrange
    const firstTest = testDouble('carrier-1', 'passed', [
      taskDouble('dup', 1, 1),
    ])
    const secondTest = testDouble('carrier-2', 'passed', [
      taskDouble('dup', 1, 1),
    ])
    const thirdTest = testDouble('carrier-3', 'passed', [
      taskDouble('dup', 1, 1),
    ])
    const firstModule = moduleDouble('__tests__/perf/first.bench.ts', [
      firstTest,
    ])
    const secondModule = moduleDouble('__tests__/perf/second.bench.ts', [
      secondTest,
      thirdTest,
    ])

    // Act
    const act = () =>
      sut.onTestRunEnd([firstModule, secondModule], [], 'passed')

    // Assert
    expect(act).toThrow(/^Duplicate benchmark names: dup$/)
    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('When two tasks are written, Then it logs a summary line per entry after the written-count lines', () => {
    // Arrange
    const testCase = testDouble('carrier', 'passed', [
      taskDouble('first-bench', 1.834881084249089, 1.1354772624809373),
      taskDouble('second-bench', 0.000026, 0.0733),
    ])
    const testModule = moduleDouble('__tests__/perf/sample.bench.ts', [
      testCase,
    ])

    // Act
    sut.onTestRunEnd([testModule], [], 'passed')

    // Assert
    expect(console.log).toHaveBeenNthCalledWith(
      1,
      'Written 2 runtime entries to perf-runtime.json'
    )
    expect(console.log).toHaveBeenNthCalledWith(
      2,
      'Written 2 latency entries to perf-memory.json'
    )
    expect(console.log).toHaveBeenNthCalledWith(
      3,
      '  first-bench: 545 ops/sec (±1.14%)'
    )
    expect(console.log).toHaveBeenNthCalledWith(
      4,
      '  second-bench: 38461538 ops/sec (±0.07%)'
    )
  })
})
