import { defineConfig } from 'vitest/config'

import { oxc } from './vitest.shared.ts'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['__tests__/nut/**/*.nut.ts'],
    testTimeout: 60000,
    // The spawned CLI looks the API version up only when none is pinned, so the
    // pin keeps an unreachable network from turning a git assertion into an
    // API-version refusal. NN.0 is mandatory: the orgApiVersion flag rejects a
    // bare integer before the command runs.
    env: { SF_ORG_API_VERSION: '60.0' },
  },
  oxc,
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
