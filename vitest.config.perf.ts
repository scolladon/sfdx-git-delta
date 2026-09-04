import { defineConfig } from 'vitest/config'

import { oxc } from './vitest.shared'

export default defineConfig({
  test: {
    benchmark: {
      include: ['__tests__/perf/**/*.bench.ts'],
      // Every export read inside src/ (Logger, lazy, PATH_SEP, ...) goes
      // through a module-runner getter. The tracker behind this warning wraps
      // each of those getters with a counter and measured 1.4-1.7x slower on
      // the registry benches; no bench file can bind that away, so it stays off.
      suppressExportGetterWarnings: true,
    },
    reporters: ['default', './__tests__/perf/perfReporter.ts'],
  },
  oxc,
})
