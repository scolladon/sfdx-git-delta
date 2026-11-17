import { rm } from 'node:fs/promises'
import { afterAll, describe } from 'vitest'
import GitAdapter from '../../lib/adapter/GitAdapter.js'
import { EMPTY_TREE_READER } from '../../lib/adapter/treeReader.js'
import { TAB } from '../../lib/constant/cliConstants.js'
import { MODIFICATION } from '../../lib/constant/gitConstants.js'
import { getDefinition } from '../../lib/metadata/metadataManager.js'
import DiffLineInterpreter from '../../lib/service/diffLineInterpreter.js'
import type { Config } from '../../lib/types/config.js'
import { createTempDir } from '../__utils__/gitTestHarness.ts'
import { buildObjectTranslationRepo } from './fixtures/objectTranslationRepoFixture.ts'
import { benchContext } from './harness/benchContext.ts'
import {
  assertScalesLinearly,
  perfBench,
  type SampledRow,
} from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Parent diff cost of modified fieldTranslation files: parent size grows with
// the child count, so a diff per child costs children x size (4x when both
// double) while one diff per parent stays near 2x.

const PARENTS = 20
const CHILDREN = 25
const CHILDREN_2X = 50

type RowCheck = (name: string, elapsedMs: readonly number[]) => void

const BASELINE_ONLY: RowCheck = () => undefined

const linearFrom =
  (baseline: SampledRow, sizeRatio: number): RowCheck =>
  (name, elapsedMs) =>
    assertScalesLinearly(
      baseline,
      { label: name, samplesMs: elapsedMs },
      sizeRatio
    )

const metadata = await getDefinition({})
const roots: string[] = []

afterAll(async () => {
  await GitAdapter.closeAll()
  await Promise.all(
    roots.map(root => rm(root, { recursive: true, force: true }))
  )
})

const runRow = async (
  name: string,
  childCount: number,
  check: RowCheck
): Promise<SampledRow> => {
  const root = await createTempDir('sgd-bench-object-translation-')
  roots.push(root)
  const { base, head, changedPaths } = buildObjectTranslationRepo(
    root,
    PARENTS,
    childCount
  )
  const config: Config = {
    source: sourceDirs('force-app/main/default'),
    output: '',
    generateDelta: true,
    to: head,
    from: base,
    mergeBase: false,
    ignore: '',
    ignoreDestructive: '',
    apiVersion: -1,
    repo: root,
    ignoreWhitespace: false,
    include: '',
    includeDestructive: '',
  }
  const lines = changedPaths.map(path => `${MODIFICATION}${TAB}${path}`)
  const elapsedMs: number[] = []
  let ctx = benchContext({ config, metadata, trees: EMPTY_TREE_READER })
  describe(name, () => {
    perfBench(
      name,
      async () => {
        const start = performance.now()
        await new DiffLineInterpreter(ctx).process(lines)
        elapsedMs.push(performance.now() - start)
      },
      {
        beforeEach: () => {
          ctx = benchContext({ config, metadata, trees: EMPTY_TREE_READER })
        },
        afterRun: () => check(name, elapsedMs),
      }
    )
  })
  return { label: name, samplesMs: elapsedMs }
}

const baseline = await runRow(
  `object-translation-${CHILDREN}-children`,
  CHILDREN,
  BASELINE_ONLY
)
await runRow(
  `object-translation-${CHILDREN_2X}-children`,
  CHILDREN_2X,
  linearFrom(baseline, CHILDREN_2X / CHILDREN)
)
