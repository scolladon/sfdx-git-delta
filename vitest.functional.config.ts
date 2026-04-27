import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    clearMocks: true,
    include: ['__tests__/functional/byteEquality/**/*.test.ts'],
    exclude: ['src', 'node_modules', '__tests__/__utils__', 'reports', 'e2e'],
  },
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
