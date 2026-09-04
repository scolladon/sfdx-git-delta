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

type Classification = { readonly tasks: readonly BenchTask[] } & (
  | { readonly broken: false }
  | { readonly broken: true; readonly name: string }
)

const tasksOf = (testCase: TestCase): BenchTask[] =>
  testCase.benchmarks().flatMap(benchmark => benchmark.tasks)

const classifyTest = (testCase: TestCase): Classification => {
  const state = testCase.result().state
  if (state === 'skipped') return { broken: false, tasks: [] }
  const tasks = tasksOf(testCase)
  return state === 'passed' && tasks.length > 0
    ? { broken: false, tasks }
    : { broken: true, name: testCase.name, tasks: [] }
}

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

const classifyTests = (modules: readonly TestModule[]): Classification[] =>
  allTestsInOrder(modules).map(classifyTest)

const brokenNamesOf = (classifications: readonly Classification[]): string[] =>
  classifications.flatMap(c => (c.broken ? [c.name] : []))

const tasksFrom = (classifications: readonly Classification[]): BenchTask[] =>
  classifications.flatMap(c => c.tasks)

const assertNoBrokenTests = (brokenNames: readonly string[]): void => {
  if (brokenNames.length === 0) return
  throw new Error(
    `Benchmarks produced no samples (their body threw): ${brokenNames.join(', ')}`
  )
}

const assertRunPassed = (reason: TestRunEndReason): void => {
  if (reason === 'passed') return
  throw new Error(
    'Benchmark run did not pass; perf-runtime.json and perf-memory.json not written'
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
    'Benchmark run interrupted: perf-runtime.json and perf-memory.json not written'
  )
}

const report = (
  testModules: ReadonlyArray<TestModule>,
  reason: TestRunEndReason
): void => {
  if (reason === 'interrupted') {
    logInterrupted()
    return
  }
  const classifications = classifyTests(testModules)
  assertNoBrokenTests(brokenNamesOf(classifications))
  assertRunPassed(reason)
  const tasks = tasksFrom(classifications)
  assertHasTasks(tasks)
  assertNonEmptyNames(tasks)
  assertUniqueNames(tasks)
  writeOutputs(tasks)
}

export default class PerfReporter implements Reporter {
  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    _unhandledErrors: ReadonlyArray<unknown>,
    reason: TestRunEndReason
  ): void {
    report(testModules, reason)
  }
}
