import { defineConfig } from 'vitest/config'

import { oxc } from './vitest.shared'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['__tests__/nut/**/*.nut.ts'],
    testTimeout: 60000,
  },
  oxc,
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
