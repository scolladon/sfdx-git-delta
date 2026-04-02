import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      outputJson: 'perf-raw.json',
    },
    include: ['__tests__/perf/**/*.bench.ts'],
  },
})
