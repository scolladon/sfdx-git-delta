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
// `hasTolerableFailure` records whether any of those samples came from a
// test that ultimately failed (e.g. a ceiling breach in `afterRun`) — the
// only kind of run-level failure the report is allowed to publish through.
type Partitioned = {
  readonly brokenNames: readonly string[]
  readonly tasks: readonly BenchTask[]
  readonly hasTolerableFailure: boolean
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

// A ceiling breach (or any other failure raised after bench() already
// collected samples) is reported, not fatal: readers get a named, actionable
// warning instead of the whole report going unpublished over one slow bench.
const warnBreach = (testCase: TestCase): void => {
  const result = testCase.result()
  if (result.state !== 'failed') return
  for (const error of result.errors) {
    console.log(`::warning::${testCase.name}: ${error.message}`)
  }
}

const partition = (modules: readonly TestModule[]): Partitioned => {
  const brokenNames: string[] = []
  const tasks: BenchTask[] = []
  let hasTolerableFailure = false
  for (const testCase of allTestsInOrder(modules)) {
    const state = testCase.result().state
    if (state === 'skipped') continue
    const own = tasksOf(testCase)
    // brokenNames keeps its narrow meaning: a bench that produced NO
    // SAMPLES at all (body threw, never ran, never called bench). Anything
    // that produced samples is published, whether or not it went on to fail.
    if (own.length === 0) {
      brokenNames.push(testCase.name)
      continue
    }
    tasks.push(...own)
    if (state !== 'passed') {
      hasTolerableFailure = true
      warnBreach(testCase)
    }
  }
  return { brokenNames, tasks, hasTolerableFailure }
}

// hasTolerableFailure is a run-level boolean: once any bench both produced
// samples and failed, assertRunPassed would otherwise wave through every
// OTHER cause of a failed run too, including a module that failed during
// collection (a syntax error, say) and so contributed zero TestCases —
// no brokenNames entry, no task, nothing for assertNoBrokenTests to name.
// This check runs independently of hasTolerableFailure so that combination
// still refuses to publish.
const assertNoCollectionErrors = (
  testModules: ReadonlyArray<TestModule>
): void => {
  const brokenModuleIds = testModules
    .filter(testModule => testModule.errors().length > 0)
    .map(testModule => testModule.relativeModuleId)
  if (brokenModuleIds.length === 0) return
  throw new Error(
    `Test module(s) failed to collect: ${brokenModuleIds.join(', ')}`
  )
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
//
// `reason` is 'failed' whenever any test failed — including a tolerated
// ceiling breach, which already published its samples with a warning. Only a
// failure with no such explanation (e.g. a hook failing outside every
// TestCase) still blocks the write.
const assertRunPassed = (
  reason: TestRunEndReason,
  unhandledErrors: ReadonlyArray<unknown>,
  hasTolerableFailure: boolean
): void => {
  if (unhandledErrors.length > 0) {
    throw new Error(
      `Benchmark run raised ${unhandledErrors.length} unhandled error(s); ${RUNTIME_PATH} and ${LATENCY_PATH} not written`
    )
  }
  if (reason === 'passed') return
  if (reason === 'failed' && hasTolerableFailure) return
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
  assertNoCollectionErrors(testModules)
  const { brokenNames, tasks, hasTolerableFailure } = partition(testModules)
  assertNoBrokenTests(brokenNames)
  assertRunPassed(reason, unhandledErrors, hasTolerableFailure)
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
