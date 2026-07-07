import { defineConfig } from 'vitest/config'

// Enable legacy (experimental) decorators explicitly for the oxc transform.
// rolldown 1.1.x stopped auto-detecting `experimentalDecorators` from tsconfig
// (rolldown/rolldown#2296), which otherwise leaves the @log decorator
// untransformed. Remove once that regression is fixed upstream.
export const oxc = { decorator: { legacy: true } }

export const sharedTestConfig = defineConfig({
  test: {
    globals: false,
    environment: 'node',
    clearMocks: true,
    exclude: ['src', 'node_modules', '__tests__/__utils__', 'reports', 'e2e'],
  },
  oxc,
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
