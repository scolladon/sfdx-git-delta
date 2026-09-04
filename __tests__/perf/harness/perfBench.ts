import { test } from 'vitest'

// tinybench 6 defaults, stated so a future tinybench bump cannot move the
// sample budget silently: every gh-pages series is comparable only while
// this budget holds.
const RUN_OPTIONS = {
  time: 1000,
  iterations: 64,
  warmupTime: 250,
  warmupIterations: 16,
} as const

// Runs once after the samples are in, so a budget assertion can be a statistic
// over the whole run rather than a max over however many samples the budget
// happened to draw. A per-sample assertion is a max-over-N: raising the sample
// count raises the breach rate without the measured cost changing at all.
type AfterRun = () => void

export const perfBench = (
  name: string,
  fn: () => unknown,
  afterRun?: AfterRun
): void => {
  test(name, async ({ bench }) => {
    await bench(name, fn).run(RUN_OPTIONS)
    afterRun?.()
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
