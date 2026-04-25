import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    clearMocks: true,
    include: ['__tests__/unit/**/*.test.ts'],
    exclude: ['src', 'node_modules', '__tests__/__utils__', 'reports', 'e2e'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'reports/coverage',
      exclude: ['node_modules/', '__tests__/__utils__/', 'reports/'],
      reporter: ['lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
