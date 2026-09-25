import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      include: ['__tests__/perf/**/*.bench.ts'],
    },
    // Vite's module runner turns every export into a getter, so a bench
    // over src/ timed the getter hops as much as the code. The benches
    // import the tsc-compiled lib/ and run under Node's native loader.
    experimental: {
      viteModuleRunner: false,
    },
    reporters: ['default', './__tests__/perf/perfReporter.ts'],
  },
})
