import { rm } from 'node:fs/promises'
import { afterAll, describe } from 'vitest'
import GitAdapter from '../../src/adapter/GitAdapter.js'
import type { Config } from '../../src/types/config.js'
import type { FileGitRef } from '../../src/types/git.js'
import { createTempDir } from '../__utils__/gitTestHarness.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { buildHistoryRepo } from './fixtures/historyRepoFixture.js'
import { assertMeanWithinCeiling, perfBench } from './harness/perfBench.js'

// Regression bench over a FIXED synthetic history (historyRepoFixture.ts),
// never over this repository's own commits: a lightweight per-run sanity
// check that a future @scolladon/tsgit upgrade (or an adapter change) has
// not silently reintroduced an order-of-magnitude slowdown. A
// materialize-everything code path is one instance buildTreeIndex is built
// to catch; the other three below catch a lost deltaCache hit or any other
// per-object cold-read regression — a different failure mode, not that one.
// The fixture is rebuilt from a fixed `git fast-import` stream on every run,
// so what these four ceilings bound is GitAdapter's own cost, never how many
// commits have landed on the branch under test. Shared CI runners are noisy
// (±40% run-to-run variance is normal, see docs/plans/tsgit-bench/README.md)
// — these ceilings exist to catch real regressions, not to police ordinary
// variance.
const REPO_ROOT = await createTempDir('sgd-bench-history-')
const { from: FROM, to: TO, blobPaths } = buildHistoryRepo(REPO_ROOT)

// A ref distinct from both FROM ('HEAD~20') and TO ('HEAD'): resolving it in
// a beforeEach hook pays tsgit's one-time repo-open cost (openRepository,
// pack index parsing — lazily paid on a handle's first read, see
// GitAdapter#getRepo). It does still warm HEAD and HEAD~1 (2 of ~21 commit
// objects in the timed walk) — resolving 'HEAD~1' must peel HEAD to reach
// its parent — but no ref in this linear fixture can avoid warming at least
// one commit that FROM or TO is about to be measured on.
const HANDLE_OPEN_REF = 'HEAD~1'

// Seeded locally, then CONFIRMED against ubuntu-latest — the runner that
// evaluates them. A ceiling compared against a CI number must be built from
// CI numbers, so these were provisional until a CI run existed for this
// fixture (it is new, and as of this change measures cold reads: closeAll +
// getInstance + one untimed open per sample, see the beforeEach hooks below).
//
// First CI perf run of this branch measured, in ms:
//   resolveCommit    4.59   (ceiling 20, headroom 4.4x)
//   streamDiffLines 15.63   (ceiling 53, headroom 3.4x)
//   getBufferContent 17.86  (ceiling 71, headroom 4.0x)
//   buildTreeIndex  12.05   (ceiling 58, headroom 4.8x)
// All four held. The values are deliberately NOT tightened to the ~3x these
// measurements alone would give (14/47/54/37): that would be a re-derivation
// from a single observation, and the same run showed pipeline-100 at 25.67ms
// against a base of 33.18ms — a 22.7% swing with no relevant code change.
// Tightening four ceilings against demonstrated +/-22% run-to-run variance
// manufactures the flake this rule exists to avoid. Re-derive properly with
// deriveCeilingMs(ciWorstMeanMs) once the gh-pages series holds three or more
// points for these names.
//
// The local derivation that produced the current values, kept because it is
// what the numbers still are: local cold worst-of-three mean x ~3.2 (the
// CI/local ratio measured independently on pipeline.bench.ts's own benches)
// x RUNNER_NOISE_FACTOR (3), rounded to the nearest whole ms via a
// one-decimal (3-significant-figure) intermediate.
//
// Local cold worst-of-three measured means, ms (three `vitest bench` runs
// against this exact beforeEach implementation, each averaging ~140-750
// fresh-handle samples). The one-decimal intermediate is why resolveCommit's
// raw 19.47 lands on 20 rather than the 19 a single direct rounding would
// give — the other three raw products round the same way either way:
//   resolveCommit:    2.0283 / 1.6642 / 1.3358  (worst × 9.6 = 19.5 -> 20)
//   streamDiffLines:  5.5584 / 5.3818 / 4.7968  (worst × 9.6 = 53.4 -> 53)
//   getBufferContent: 7.1166 / 7.3443 / 6.4534  (worst × 9.6 = 70.5 -> 71)
//   buildTreeIndex:   5.9972 / 4.6063 / 6.0402  (worst × 9.6 = 58.0 -> 58,
//     unchanged bench body — see its own describe)
//
// getBufferContent disagrees sharply with a design-doc estimate of 2.6ms:
// measured here it is the single most expensive read of the four, not the
// cheapest. Isolated follow-up (one blob, one revision, same beforeEach)
// still cost 3.06ms (FROM) / 4.36ms (TO) per single cold read — this
// fixture's ~9KB blobs are packed as delta chains against every prior
// revision (historyRepoFixture writes both BLOB_PATH_A/B on all 21 commits),
// so a cold read walks that chain; a Map-lookup-cheap estimate does not hold
// here. Ceiling below is derived from the measurement actually reproduced on
// this fixture, not the estimate.
const RESOLVE_COMMIT_CEILING_MS = 20
const STREAM_DIFF_LINES_CEILING_MS = 53
const BLOB_READ_CEILING_MS = 71
const BUILD_TREE_INDEX_CEILING_MS = 58

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

// A fresh handle per sample (closeAll + getInstance in beforeEach, which
// tinybench runs outside the timed window — see perfBench's PerfBenchHooks
// doc) so every timed resolveCommit call below hits an empty deltaCache —
// the cost a real sgd() invocation always pays, since it opens exactly one
// handle per run and resolves --from/--to on it exactly once.
describe('gitAdapter-history-resolveCommit', () => {
  const elapsedMs: number[] = []
  let adapter: GitAdapter

  perfBench(
    'resolveCommit-fixture-HEAD~20-and-HEAD',
    async () => {
      const start = performance.now()
      await adapter.resolveCommit(FROM)
      await adapter.resolveCommit(TO)
      elapsedMs.push(performance.now() - start)
    },
    {
      beforeEach: async () => {
        await GitAdapter.closeAll()
        adapter = GitAdapter.getInstance(baseConfig)
        await adapter.resolveCommit(HANDLE_OPEN_REF)
      },
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
  const elapsedMs: number[] = []
  let adapter: GitAdapter

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
      beforeEach: async () => {
        await GitAdapter.closeAll()
        adapter = GitAdapter.getInstance(baseConfig)
        await adapter.resolveCommit(HANDLE_OPEN_REF)
      },
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
  const elapsedMs: number[] = []
  let adapter: GitAdapter

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
      beforeEach: async () => {
        await GitAdapter.closeAll()
        adapter = GitAdapter.getInstance(baseConfig)
        await adapter.resolveCommit(HANDLE_OPEN_REF)
      },
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
// every time — the same cost a fresh CLI invocation pays exactly once. This
// was already cold before this change and its in-sample closeAll() is
// settled: left exactly as it is.
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
