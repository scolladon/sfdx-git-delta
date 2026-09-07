import { rm } from 'node:fs/promises'
import { afterAll, describe } from 'vitest'
import GitAdapter from '../../src/adapter/GitAdapter.js'
import type { Config } from '../../src/types/config.js'
import type { FileGitRef } from '../../src/types/git.js'
import { createTempDir } from '../__utils__/gitTestHarness.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { buildHistoryRepo } from './fixtures/historyRepoFixture.js'
import {
  assertMeanWithinCeiling,
  perfBench,
  RUNNER_NOISE_FACTOR,
} from './harness/perfBench.js'

// Regression bench over a FIXED synthetic history (historyRepoFixture.ts),
// never over this repository's own commits: a lightweight per-run sanity
// check that a future @scolladon/tsgit upgrade (or an adapter change) has
// not silently reintroduced an order-of-magnitude slowdown (e.g. a
// materialize-everything code path). The fixture is rebuilt from a fixed
// `git fast-import` stream on every run, so what these four ceilings bound
// is GitAdapter's own cost, never how many commits have landed on the
// branch under test. Ceilings are deliberately generous — shared CI runners
// are noisy (±40% run-to-run variance is normal, see
// docs/plans/tsgit-bench/README.md) — so these exist to catch real
// regressions, not to police ordinary variance.
const REPO_ROOT = await createTempDir('sgd-bench-history-')
const { from: FROM, to: TO, blobPaths } = buildHistoryRepo(REPO_ROOT)

const deriveCeilingMs = (worstMeanMs: number): number =>
  Math.ceil((worstMeanMs * RUNNER_NOISE_FACTOR) / 100) * 100

// Re-derived against the fixture above (worst-of-three measured means, ms):
//   resolveCommit:    0.5614 / 0.5494 / 0.5526
//   streamDiffLines:  1.6279 / 1.6010 / 1.5901
//   getBufferContent: 0.0214 / 0.0213 / 0.0214
//   buildTreeIndex:   6.3120 / 6.1365 / 6.1487
// Ceiling is the worst mean × RUNNER_NOISE_FACTOR, rounded up to the next
// 100ms (the pipeline.bench.ts convention).
const RESOLVE_COMMIT_WORST_MEAN_MS = 0.5614
const STREAM_DIFF_LINES_WORST_MEAN_MS = 1.6279
const BLOB_READ_WORST_MEAN_MS = 0.0214
const BUILD_TREE_INDEX_WORST_MEAN_MS = 6.312

const RESOLVE_COMMIT_CEILING_MS = deriveCeilingMs(RESOLVE_COMMIT_WORST_MEAN_MS)
const BUILD_TREE_INDEX_CEILING_MS = deriveCeilingMs(
  BUILD_TREE_INDEX_WORST_MEAN_MS
)
const STREAM_DIFF_LINES_CEILING_MS = deriveCeilingMs(
  STREAM_DIFF_LINES_WORST_MEAN_MS
)
const BLOB_READ_CEILING_MS = deriveCeilingMs(BLOB_READ_WORST_MEAN_MS)

const BLOB_REFS: FileGitRef[] = [FROM, TO].flatMap(oid =>
  blobPaths.map(path => ({ path, oid }))
)

const baseConfig: Config = {
  to: TO,
  from: FROM,
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: REPO_ROOT,
  ignoreWhitespace: false,
  generateDelta: false,
}

afterAll(async () => {
  await GitAdapter.closeAll()
  await rm(REPO_ROOT, { recursive: true, force: true })
})

describe('gitAdapter-history-resolveCommit', () => {
  const adapter = GitAdapter.getInstance(baseConfig)

  const elapsedMs: number[] = []

  perfBench(
    'resolveCommit-fixture-HEAD~20-and-HEAD',
    async () => {
      const start = performance.now()
      await adapter.resolveCommit(FROM)
      await adapter.resolveCommit(TO)
      elapsedMs.push(performance.now() - start)
    },
    {
      afterRun: () =>
        assertMeanWithinCeiling(
          'resolveCommit',
          elapsedMs,
          RESOLVE_COMMIT_CEILING_MS
        ),
    }
  )
})

describe('gitAdapter-history-streamDiffLines', () => {
  const adapter = GitAdapter.getInstance(baseConfig)

  const elapsedMs: number[] = []

  perfBench(
    'streamDiffLines-fixture-HEAD~20..HEAD',
    async () => {
      const start = performance.now()
      const verdict = { changesSeen: 0, linesYielded: 0 }
      for await (const _line of adapter.streamDiffLines({
        spec: {
          from: baseConfig.from,
          to: baseConfig.to,
          detectRenames: Boolean(baseConfig.changesManifest),
          ignoreWhitespace: baseConfig.ignoreWhitespace,
        },
        verdict,
        scopes: baseConfig.source,
      })) {
        // Draining the generator is the measured cost; the lines themselves
        // are not asserted on here (that is gitBackendParity's job).
      }
      elapsedMs.push(performance.now() - start)
    },
    {
      afterRun: () =>
        assertMeanWithinCeiling(
          'streamDiffLines',
          elapsedMs,
          STREAM_DIFF_LINES_CEILING_MS
        ),
    }
  )
})

describe('gitAdapter-history-blobReads', () => {
  const adapter = GitAdapter.getInstance(baseConfig)

  const elapsedMs: number[] = []

  perfBench(
    'getBufferContent-fixture-HEAD~20-and-HEAD',
    async () => {
      const start = performance.now()
      for (const ref of BLOB_REFS) {
        await adapter.getBufferContent(ref)
      }
      elapsedMs.push(performance.now() - start)
    },
    {
      afterRun: () =>
        assertMeanWithinCeiling(
          'getBufferContent',
          elapsedMs,
          BLOB_READ_CEILING_MS
        ),
    }
  )
})

// buildTreeIndex's underlying blob-id walk (indexRevision) memoizes per
// revision on the adapter instance, so a shared instance would measure a
// cache hit (a Map lookup) on every sample after the first. Closing and
// re-acquiring the singleton each iteration forces a genuine cold tree walk
// every time — the same cost a fresh CLI invocation pays exactly once.
describe('gitAdapter-history-buildTreeIndex', () => {
  const elapsedMs: number[] = []

  perfBench(
    'buildTreeIndex-fixture-HEAD-cold',
    async () => {
      await GitAdapter.closeAll()
      const adapter = GitAdapter.getInstance(baseConfig)
      const start = performance.now()
      await adapter.buildTreeIndex(TO, ['.'])
      elapsedMs.push(performance.now() - start)
    },
    {
      afterRun: () =>
        assertMeanWithinCeiling(
          'buildTreeIndex',
          elapsedMs,
          BUILD_TREE_INDEX_CEILING_MS
        ),
    }
  )
})
