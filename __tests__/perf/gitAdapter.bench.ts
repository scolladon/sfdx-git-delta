import { afterAll, describe } from 'vitest'
import GitAdapter from '../../src/adapter/GitAdapter.js'
import type { Config } from '../../src/types/config.js'
import type { FileGitRef } from '../../src/types/git.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { assertMeanWithinCeiling, perfBench } from './harness/perfBench.js'

// Regression bench over the sgd repo's OWN history (HEAD~20..HEAD): a
// lightweight per-run sanity check that a future @scolladon/tsgit upgrade
// (or an adapter change) has not silently reintroduced an order-of-magnitude
// slowdown (e.g. a materialize-everything code path). Ceilings are
// deliberately generous — shared CI runners are noisy (±40% run-to-run
// variance is normal, see docs/plans/tsgit-bench/README.md) — so these exist
// to catch real regressions, not to police ordinary variance.
const REPO_ROOT = process.cwd()
const FROM = 'HEAD~20'
const TO = 'HEAD'

const PARSE_REV_CEILING_MS = 200
const BUILD_TREE_INDEX_CEILING_MS = 1_000
const STREAM_DIFF_LINES_CEILING_MS = 500
const BLOB_READ_CEILING_MS = 200

const BLOB_REFS: FileGitRef[] = [
  { path: 'package.json', oid: FROM },
  { path: 'src/main.ts', oid: FROM },
  { path: 'package.json', oid: TO },
  { path: 'src/main.ts', oid: TO },
]

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
})

describe('gitAdapter-history-parseRev', () => {
  const adapter = GitAdapter.getInstance(baseConfig)

  const elapsedMs: number[] = []

  perfBench(
    'parseRev-HEAD~20-and-HEAD',
    async () => {
      const start = performance.now()
      await adapter.parseRev(FROM)
      await adapter.parseRev(TO)
      elapsedMs.push(performance.now() - start)
    },
    () => assertMeanWithinCeiling('parseRev', elapsedMs, PARSE_REV_CEILING_MS)
  )
})

describe('gitAdapter-history-streamDiffLines', () => {
  const adapter = GitAdapter.getInstance(baseConfig)

  const elapsedMs: number[] = []

  perfBench(
    'streamDiffLines-HEAD~20..HEAD',
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
    () =>
      assertMeanWithinCeiling(
        'streamDiffLines',
        elapsedMs,
        STREAM_DIFF_LINES_CEILING_MS
      )
  )
})

describe('gitAdapter-history-blobReads', () => {
  const adapter = GitAdapter.getInstance(baseConfig)

  const elapsedMs: number[] = []

  perfBench(
    'getBufferContent-HEAD~20-and-HEAD',
    async () => {
      const start = performance.now()
      for (const ref of BLOB_REFS) {
        await adapter.getBufferContent(ref)
      }
      elapsedMs.push(performance.now() - start)
    },
    () =>
      assertMeanWithinCeiling(
        'getBufferContent',
        elapsedMs,
        BLOB_READ_CEILING_MS
      )
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
    'buildTreeIndex-HEAD-cold',
    async () => {
      await GitAdapter.closeAll()
      const adapter = GitAdapter.getInstance(baseConfig)
      const start = performance.now()
      await adapter.buildTreeIndex(TO, ['.'])
      elapsedMs.push(performance.now() - start)
    },
    () =>
      assertMeanWithinCeiling(
        'buildTreeIndex',
        elapsedMs,
        BUILD_TREE_INDEX_CEILING_MS
      )
  )
})
