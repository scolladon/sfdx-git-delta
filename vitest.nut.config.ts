import { defineConfig } from 'vitest/config'

import { oxc } from './vitest.shared.ts'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['__tests__/nut/**/*.nut.ts'],
    testTimeout: 60000,
    // The spawned CLI caps apiVersion against a live appexchange lookup. A pinned
    // value takes the tolerant path, so an unreachable network cannot turn a git
    // assertion into an API-version refusal. NN.0 is mandatory: the orgApiVersion
    // flag rejects a bare integer before the command runs.
    env: { SF_ORG_API_VERSION: '60.0' },
  },
  oxc,
  resolve: {
    alias: [{ find: /^(.+)\.js$/, replacement: '$1' }],
  },
})
