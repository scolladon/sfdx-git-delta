import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['__tests__/nut/**/*.nut.ts'],
    testTimeout: 60000,
  },
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
