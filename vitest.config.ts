import { defineConfig } from 'vitest/config'

import { oxc } from './vitest.shared'

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
      // Directory-prefix excludes stopped matching in vitest 5; these must
      // be globs or the test helpers land in the coverage denominator.
      exclude: [
        '**/node_modules/**',
        '**/__tests__/__utils__/**',
        '**/reports/**',
      ],
      reporter: ['lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
  oxc,
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
