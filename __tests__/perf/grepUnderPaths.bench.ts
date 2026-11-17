import { rm } from 'node:fs/promises'
import { afterAll, describe } from 'vitest'
import GitAdapter from '../../lib/adapter/GitAdapter.js'
import { MASTER_DETAIL_TAG } from '../../lib/constant/metadataConstants.js'
import type { Config } from '../../lib/types/config.js'
import { createTempDir } from '../__utils__/gitTestHarness.ts'
import { buildMasterDetailRepo } from './fixtures/masterDetailRepoFixture.ts'
import {
  assertScalesLinearly,
  perfBench,
  type SampledRow,
} from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Per-call cost of the literal grep surface: calls and repository size both
// double between a baseline row and its scaled row, so a per-call scan of
// the revision costs 4x while the indexed lookup stays near 2x.

const OBJECTS_500 = 500
const OBJECTS_1000 = 1_000

type RowCheck = (name: string, elapsedMs: readonly number[]) => void

// Baselines carry no bound of their own; the scaled row is bounded by its
// growth over the baseline of the same run.
const BASELINE_ONLY: RowCheck = () => undefined

const linearFrom =
  (baseline: SampledRow, sizeRatio: number): RowCheck =>
  (name, elapsedMs) =>
    assertScalesLinearly(
      baseline,
      { label: name, samplesMs: elapsedMs },
      sizeRatio
    )

const roots: string[] = []

afterAll(async () => {
  await GitAdapter.closeAll()
  await Promise.all(
    roots.map(root => rm(root, { recursive: true, force: true }))
  )
})

type Target = 'files' | 'dirs'

const runRow = async (
  name: string,
  objectCount: number,
  target: Target,
  check: RowCheck
): Promise<SampledRow> => {
  const root = await createTempDir('sgd-bench-grep-')
  roots.push(root)
  const { head, fieldFiles, fieldDirs } = buildMasterDetailRepo(
    root,
    objectCount
  )
  const specs = target === 'files' ? fieldFiles : fieldDirs
  const config: Config = {
    to: head,
    from: head,
    mergeBase: false,
    output: '',
    source: sourceDirs('.'),
    repo: root,
    ignoreWhitespace: false,
    generateDelta: false,
  }
  const adapter = GitAdapter.getInstance(config)
  const elapsedMs: number[] = []
  describe(name, () => {
    perfBench(
      name,
      async () => {
        const start = performance.now()
        for (const spec of specs) {
          await adapter.grepUnderPaths(MASTER_DETAIL_TAG, spec, head)
        }
        elapsedMs.push(performance.now() - start)
      },
      {
        beforeEach: async () => {
          await adapter.grepUnderPaths(MASTER_DETAIL_TAG, specs[0]!, head)
        },
        afterRun: () => check(name, elapsedMs),
      }
    )
  })
  return { label: name, samplesMs: elapsedMs }
}

const fileBaseline = await runRow(
  `grep-file-specs-${OBJECTS_500}`,
  OBJECTS_500,
  'files',
  BASELINE_ONLY
)
await runRow(
  `grep-file-specs-${OBJECTS_1000}`,
  OBJECTS_1000,
  'files',
  linearFrom(fileBaseline, OBJECTS_1000 / OBJECTS_500)
)
const dirBaseline = await runRow(
  `grep-dir-specs-${OBJECTS_500}`,
  OBJECTS_500,
  'dirs',
  BASELINE_ONLY
)
await runRow(
  `grep-dir-specs-${OBJECTS_1000}`,
  OBJECTS_1000,
  'dirs',
  linearFrom(dirBaseline, OBJECTS_1000 / OBJECTS_500)
)
