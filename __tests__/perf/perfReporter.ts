import { writeFileSync } from 'node:fs'
import type {
  Reporter,
  TestCase,
  TestModule,
  TestRunEndReason,
} from 'vitest/node'

type BenchTask = ReturnType<TestCase['benchmarks']>[number]['tasks'][number]
type Unit = 'ops/sec' | 'ms'
type Entry = { name: string; unit: Unit; value: number; range: string }

const RUNTIME_PATH = 'perf-runtime.json'
// Historical name: the gh-pages series is dev/bench/memory; it carries mean latency in ms.
const LATENCY_PATH = 'perf-memory.json'
const MS_PER_SECOND = 1000
const LATENCY_DECIMALS = 4
const RME_DECIMALS = 2

const range = (task: BenchTask): string =>
  `±${task.latency.rme.toFixed(RME_DECIMALS)}%`

const toRuntimeEntry = (task: BenchTask): Entry => ({
  name: task.name,
  unit: 'ops/sec',
  value: Math.round(MS_PER_SECOND / task.latency.mean),
  range: range(task),
})

const toLatencyEntry = (task: BenchTask): Entry => ({
  name: task.name,
  unit: 'ms',
  value: Number(task.latency.mean.toFixed(LATENCY_DECIMALS)),
  range: range(task),
})

// A test either contributed samples or is broken; partitioning once keeps the
// two sides from having to be re-narrowed (and re-checked) further down.
type Partitioned = {
  readonly brokenNames: readonly string[]
  readonly tasks: readonly BenchTask[]
}

const tasksOf = (testCase: TestCase): BenchTask[] =>
  testCase.benchmarks().flatMap(benchmark => benchmark.tasks)

// relativeModuleId is a file path: two modules never share one, so the
// comparator only needs a total order between "before" and "after".
const byRelativeModuleId = (a: TestModule, b: TestModule): number =>
  a.relativeModuleId < b.relativeModuleId ? -1 : 1

const sortedModules = (modules: ReadonlyArray<TestModule>): TestModule[] =>
  [...modules].sort(byRelativeModuleId)

const allTestsInOrder = (modules: readonly TestModule[]): TestCase[] =>
  sortedModules(modules).flatMap(testModule => [
    ...testModule.children.allTests(),
  ])

const partition = (modules: readonly TestModule[]): Partitioned => {
  const brokenNames: string[] = []
  const tasks: BenchTask[] = []
  for (const testCase of allTestsInOrder(modules)) {
    const state = testCase.result().state
    if (state === 'skipped') continue
    const own = tasksOf(testCase)
    if (state === 'passed' && own.length > 0) tasks.push(...own)
    else brokenNames.push(testCase.name)
  }
  return { brokenNames, tasks }
}

const assertNoBrokenTests = (brokenNames: readonly string[]): void => {
  if (brokenNames.length === 0) return
  throw new Error(
    `Benchmarks produced no samples (body threw, never ran, or never called bench): ${brokenNames.join(', ')}`
  )
}

// vitest derives `reason` from module results alone, but an unhandled error
// sets a non-zero exit code on its own path — so a run can arrive here as
// 'passed' while having failed. Writing then would publish a series built from
// an incomplete run.
const assertRunPassed = (
  reason: TestRunEndReason,
  unhandledErrors: ReadonlyArray<unknown>
): void => {
  if (unhandledErrors.length > 0) {
    throw new Error(
      `Benchmark run raised ${unhandledErrors.length} unhandled error(s); ${RUNTIME_PATH} and ${LATENCY_PATH} not written`
    )
  }
  if (reason === 'passed') return
  throw new Error(
    `Benchmark run did not pass; ${RUNTIME_PATH} and ${LATENCY_PATH} not written`
  )
}

const assertHasTasks = (tasks: readonly BenchTask[]): void => {
  if (tasks.length > 0) return
  throw new Error('No benchmark results collected; nothing written')
}

const assertNonEmptyNames = (tasks: readonly BenchTask[]): void => {
  if (tasks.every(task => task.name !== '')) return
  throw new Error('Benchmark task names must be non-empty')
}

const duplicateNames = (tasks: readonly BenchTask[]): string[] => {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const task of tasks) {
    if (seen.has(task.name)) dupes.add(task.name)
    seen.add(task.name)
  }
  return [...dupes]
}

const assertUniqueNames = (tasks: readonly BenchTask[]): void => {
  const dupes = duplicateNames(tasks)
  if (dupes.length === 0) return
  throw new Error(`Duplicate benchmark names: ${dupes.join(', ')}`)
}

const logSummary = (runtime: readonly Entry[]): void => {
  console.log(`Written ${runtime.length} runtime entries to ${RUNTIME_PATH}`)
  console.log(`Written ${runtime.length} latency entries to ${LATENCY_PATH}`)
  for (const entry of runtime) {
    console.log(
      `  ${entry.name}: ${entry.value} ${entry.unit} (${entry.range})`
    )
  }
}

const writeOutputs = (tasks: readonly BenchTask[]): void => {
  const runtime = tasks.map(toRuntimeEntry)
  const latency = tasks.map(toLatencyEntry)
  writeFileSync(RUNTIME_PATH, JSON.stringify(runtime, null, 2))
  writeFileSync(LATENCY_PATH, JSON.stringify(latency, null, 2))
  logSummary(runtime)
}

const logInterrupted = (): void => {
  console.log(
    `Benchmark run interrupted: ${RUNTIME_PATH} and ${LATENCY_PATH} not written`
  )
}

const report = (
  testModules: ReadonlyArray<TestModule>,
  unhandledErrors: ReadonlyArray<unknown>,
  reason: TestRunEndReason
): void => {
  if (reason === 'interrupted') {
    logInterrupted()
    return
  }
  const { brokenNames, tasks } = partition(testModules)
  assertNoBrokenTests(brokenNames)
  assertRunPassed(reason, unhandledErrors)
  assertHasTasks(tasks)
  assertNonEmptyNames(tasks)
  assertUniqueNames(tasks)
  writeOutputs(tasks)
}

export default class PerfReporter implements Reporter {
  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<unknown>,
    reason: TestRunEndReason
  ): void {
    report(testModules, unhandledErrors, reason)
  }
}
