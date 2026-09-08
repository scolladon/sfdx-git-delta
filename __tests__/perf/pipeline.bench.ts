import { rm } from 'node:fs/promises'
import { afterAll, describe, vi } from 'vitest'
import sgd from '../../src/main.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import type { ConfigInput } from '../../src/types/config.js'
import ChangeSet from '../../src/utils/changeSet.js'
import { computeTreeIndexScope } from '../../src/utils/treeIndexScope.js'
import { createTempDir } from '../__utils__/gitTestHarness.js'
import {
  generateDiffFixtures,
  generateManifestElements,
} from './fixtures/generateFixtures.js'
import { buildLwcDiffRepo } from './fixtures/lwcRepoFixture.js'
import {
  assertMeanWithinCeiling,
  deriveCeilingMs,
  perfBench,
} from './harness/perfBench.js'

const metadata = await getDefinition({})

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const { lines } = generateDiffFixtures(size)
  const elements = generateManifestElements(size)

  describe(`pipeline-${size}`, () => {
    perfBench(`pipeline-${size}-tree-scope`, () => {
      computeTreeIndexScope(lines, metadata)
    })

    perfBench(`pipeline-${size}-manifest-aggregation`, () => {
      ChangeSet.from(elements)
    })
  })
}

// Same seam the parity integration test pins: the apiVersion cap is a live
// SDR coverage lookup; pinned so every sample measures sgd, not the network.
const API_VERSION = 60
vi.mock('../../src/metadata/metadataManager.js', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../src/metadata/metadataManager.js')
  >()),
  getLatestSupportedVersion: async () => API_VERSION,
}))

const BUNDLE_COUNTS = [100, 1_000] as const

// Derived from the live gh-pages series (dev/bench/runtime, 48 runs on
// ubuntu-latest, the runner assertMeanWithinCeiling actually runs on) rather
// than a developer machine: a local Apple M3 mean under-measures this bench
// by 3.0-3.45x relative to CI, which alone consumed all of
// RUNNER_NOISE_FACTOR's headroom and made the old dev-machine-derived
// ceilings breach on CI 3 of 4 times. CI-observed means for
// pipeline-100-bundles: 26.88/31.56/33.30/33.18ms (max 33.30); for
// pipeline-1000-bundles: 140.46/160.29/166.77/167.90ms (max 167.90). Ceiling
// is the CI max × RUNNER_NOISE_FACTOR, rounded up to two significant figures
// (see deriveCeilingMs). Rule: re-derive this from the gh-pages series, never
// from a developer machine — a local mean is not a stand-in for what CI
// actually measures.
const WORST_MEAN_MS: Record<(typeof BUNDLE_COUNTS)[number], number> = {
  100: 33.3,
  1_000: 167.9,
}

const SGD_NO_DELTA_CEILING_MS: Record<(typeof BUNDLE_COUNTS)[number], number> =
  {
    100: deriveCeilingMs(WORST_MEAN_MS[100]),
    1_000: deriveCeilingMs(WORST_MEAN_MS[1_000]),
  }

const tempDirs: string[] = []

for (const count of BUNDLE_COUNTS) {
  const dir = await createTempDir(`sgd-bench-lwc-${count}-`)
  const refs = buildLwcDiffRepo(dir, count)
  const output = await createTempDir('sgd-bench-out-')
  tempDirs.push(dir, output)

  const input: ConfigInput = {
    to: refs.head,
    from: refs.root,
    repo: dir,
    output,
    source: ['force-app'],
    generateDelta: false,
    mergeBase: false,
    ignoreWhitespace: false,
    apiVersion: API_VERSION,
  }

  describe(`pipeline-sgd-no-delta-${count}-bundles`, () => {
    const elapsedMs: number[] = []

    perfBench(
      `pipeline-sgd-no-delta-${count}-bundles`,
      async () => {
        const start = performance.now()
        await sgd(input)
        elapsedMs.push(performance.now() - start)
      },
      {
        afterRun: () =>
          assertMeanWithinCeiling(
            `sgd-no-delta-${count}-bundles`,
            elapsedMs,
            SGD_NO_DELTA_CEILING_MS[count]
          ),
      }
    )
  })
}

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})
