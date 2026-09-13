import { defineConfig, mergeConfig } from 'vitest/config'

import { sharedTestConfig } from './vitest.shared.ts'

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      include: ['__tests__/integration/**/*.test.ts'],
      // The spawned CLI caps apiVersion against a live appexchange lookup. A pinned
      // value takes the tolerant path, so an unreachable network cannot turn a git
      // assertion into an API-version refusal. NN.0 is mandatory: the orgApiVersion
      // flag rejects a bare integer before the command runs.
      env: { SF_ORG_API_VERSION: '60.0' },
    },
  })
)
