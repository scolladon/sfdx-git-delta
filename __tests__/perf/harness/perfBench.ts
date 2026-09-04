import { test } from 'vitest'

// tinybench 6 defaults, stated so a future tinybench bump cannot move the
// sample budget silently: every gh-pages series is comparable only while
// this budget holds.
export const RUN_OPTIONS = {
  time: 1000,
  iterations: 64,
  warmupTime: 250,
  warmupIterations: 16,
} as const

export const perfBench = (name: string, fn: () => unknown): void => {
  test(name, async ({ bench }) => {
    await bench(name, fn).run(RUN_OPTIONS)
  })
}
