import { defineConfig, mergeConfig } from 'vitest/config'

import { sharedTestConfig } from './vitest.shared.ts'

// SDR's API version lookup picks its proxy with proxy-from-env: the first set
// of npm_config_https_proxy, https_proxy, HTTPS_PROXY wins, and any no_proxy
// spelling it reaches can bypass it. npm run and npm exec export an npmrc
// https-proxy as npm_config_https_proxy, which is why that name leads; the
// conventional names cover clients that read only those, and every no_proxy
// spelling is emptied because each is consulted when the earlier ones are
// empty. networkIsolation.test.ts fails if the lookup stops being refused
// here. Uppercase NPM_CONFIG_NO_PROXY is emptied too: proxy-from-env falls
// back to it when the lowercase name is empty.
const UNREACHABLE_PROXY = 'http://127.0.0.1:9'
const OFFLINE_ENV = {
  npm_config_https_proxy: UNREACHABLE_PROXY,
  https_proxy: UNREACHABLE_PROXY,
  HTTPS_PROXY: UNREACHABLE_PROXY,
  npm_config_no_proxy: '',
  no_proxy: '',
  NO_PROXY: '',
  NPM_CONFIG_NO_PROXY: '',
}

export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      include: ['__tests__/integration/**/*.test.ts'],
      // The spawned CLI caps apiVersion against a live appexchange lookup. A pinned
      // value takes the tolerant path, so an unreachable network cannot turn a git
      // assertion into an API-version refusal. NN.0 is mandatory: the orgApiVersion
      // flag rejects a bare integer before the command runs.
      env: { SF_ORG_API_VERSION: '60.0', ...OFFLINE_ENV },
    },
  })
)
