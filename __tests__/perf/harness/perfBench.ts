import { test } from 'vitest'

// Shared runners are noisy (±40% run-to-run is normal); ceilings exist to
// catch an order-of-magnitude regression, not to police variance. A ceiling
// bounds the worst-of-three measured mean × this factor, rounded up to two
// significant figures (see deriveCeilingMs) — scaling with the measurement
// rather than flooring at a round number, so a ceiling stays capable of
// failing even when the measured cost is well under 100ms.
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
  hooks: PerfBenchHooks | (() => void) = {}
): void => {
  // __tests__ is not type-checked, so a call site regressed to the old
  // positional `afterRun` function reads `hooks.afterRun` as undefined and
  // its budget assertion silently stops running. Refuse it at runtime.
  if (typeof hooks === 'function') {
    throw new Error(
      `perfBench("${name}") received a function as its third argument; pass { afterRun } instead of the old positional afterRun callback`
    )
  }
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

// "Two significant figures" arithmetically means: locate the order of
// magnitude one digit below raw's leading digit, then round up to a
// multiple of it — e.g. a 6.312ms worst mean × 3 = 18.936 rounds up to 19,
// not 18.936 verbatim or a flattened 20.
const TWO_SIGNIFICANT_FIGURES_OFFSET = 1
// Math.log10/Math.ceil can leave float noise on the result (e.g.
// 1.7000000000000002 instead of 1.7); a coarse display precision strips
// that noise without touching the two significant figures above.
const CEILING_DISPLAY_PRECISION = 10

// A ceiling scales with what it bounds: a fixed 100ms floor is degenerate
// for any worst mean below ~33ms (RUNNER_NOISE_FACTOR × mean never reaches
// the floor), which is exactly why perfBench ceilings used to sit 10x-4600x
// above their real cost. Deriving the ceiling from the measurement itself —
// rounded up to two significant figures rather than flattened to a round
// number — keeps it capable of catching an order-of-magnitude regression at
// any scale.
export const deriveCeilingMs = (worstMeanMs: number): number => {
  // Math.log10(0) is -Infinity, so a zero (or negative, or non-finite)
  // worstMeanMs would otherwise flow through to a NaN step and a ceiling
  // that can never be exceeded — a ceiling that silently cannot fail.
  if (!Number.isFinite(worstMeanMs) || worstMeanMs <= 0) {
    throw new Error(
      `deriveCeilingMs requires a finite, positive worstMeanMs; got ${worstMeanMs}`
    )
  }
  const raw = worstMeanMs * RUNNER_NOISE_FACTOR
  const step =
    10 ** Math.floor(Math.log10(raw) - TWO_SIGNIFICANT_FIGURES_OFFSET)
  const ceiling = Math.ceil(raw / step) * step
  return Number(ceiling.toPrecision(CEILING_DISPLAY_PRECISION))
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
