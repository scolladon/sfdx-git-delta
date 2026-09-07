import { test } from 'vitest'

// Shared runners are noisy (±40% run-to-run is normal); ceilings exist to
// catch an order-of-magnitude regression, not to police variance. A ceiling
// bounds the worst-of-three measured mean × this factor, rounded up to the
// next 100ms.
export const RUNNER_NOISE_FACTOR = 3

// tinybench 6 defaults, stated so a future tinybench bump cannot move the
// sample budget silently: every gh-pages series is comparable only while
// this budget holds.
const RUN_OPTIONS = {
  time: 1000,
  iterations: 64,
  warmupTime: 250,
  warmupIterations: 16,
} as const

export type PerfBenchHooks = Readonly<{
  // Runs before every iteration, warmup included, outside the timed window
  // (tinybench times only `fn`): the place to build inputs a sample must not
  // pay for, and the only place a per-iteration cold state can be made.
  beforeEach?: () => void | Promise<void>
  // Runs once after the samples are in, so a budget assertion can be a
  // statistic over the whole run rather than a max over however many
  // samples the budget happened to draw. A per-sample assertion is a
  // max-over-N: raising the sample count raises the breach rate without the
  // measured cost changing at all.
  afterRun?: () => void
}>

export const perfBench = (
  name: string,
  fn: () => unknown,
  hooks: PerfBenchHooks = {}
): void => {
  test(name, async ({ bench }) => {
    // tinybench crashes reading a property off an `undefined` options
    // object, so a hookless bench must call the two-argument overload
    // rather than pass `undefined` where `{ beforeEach }` would go.
    const task = hooks.beforeEach
      ? bench(name, { beforeEach: hooks.beforeEach }, fn)
      : bench(name, fn)
    await task.run(RUN_OPTIONS)
    hooks.afterRun?.()
  })
}

// The window a budget covers is usually narrower than the whole bench body
// (setup a sample must redo, but that the budget is not about, is excluded),
// so callers record their own elapsed times and hand the collected samples here.
export const assertMeanWithinCeiling = (
  label: string,
  samplesMs: readonly number[],
  ceilingMs: number
): void => {
  if (samplesMs.length === 0) {
    throw new Error(`${label} recorded no samples to check against its ceiling`)
  }
  const mean = samplesMs.reduce((sum, ms) => sum + ms, 0) / samplesMs.length
  if (mean > ceilingMs) {
    throw new Error(
      `${label} averaged ${mean.toFixed(2)}ms over ${samplesMs.length} samples, exceeding the ${ceilingMs}ms noise-tolerant ceiling`
    )
  }
}
