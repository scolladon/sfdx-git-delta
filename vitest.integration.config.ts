import { defineConfig, mergeConfig } from 'vitest/config'

import { sharedTestConfig } from './vitest.shared'

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      include: ['__tests__/integration/**/*.test.ts'],
    },
  })
)
