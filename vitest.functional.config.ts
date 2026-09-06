import { defineConfig, mergeConfig } from 'vitest/config'

import { sharedTestConfig } from './vitest.shared.ts'

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      include: ['__tests__/functional/byteEquality/**/*.test.ts'],
    },
  })
)
