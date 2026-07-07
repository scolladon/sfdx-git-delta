import { defineConfig } from 'vitest/config'

import { oxc } from './vitest.shared'

export default defineConfig({
  test: {
    benchmark: {
      outputJson: 'perf-raw.json',
    },
    include: ['__tests__/perf/**/*.bench.ts'],
  },
  oxc,
})
