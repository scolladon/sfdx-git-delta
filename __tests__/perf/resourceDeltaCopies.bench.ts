import { describe } from 'vitest'
import { TreeIndex } from '../../lib/adapter/treeIndex.js'
import {
  createTreeReader,
  type TreeReader,
} from '../../lib/adapter/treeReader.js'
import { TAB } from '../../lib/constant/cliConstants.js'
import { MODIFICATION } from '../../lib/constant/gitConstants.js'
import { getDefinition } from '../../lib/metadata/metadataManager.js'
import DiffLineInterpreter from '../../lib/service/diffLineInterpreter.js'
import type { Config } from '../../lib/types/config.js'
import { NO_UNIONS } from '../../lib/types/runContext.js'
import { expandComponentCopies } from '../../lib/utils/componentCopies.js'
import {
  assertMeanWithinCeiling,
  assertScalesLinearly,
  deriveCeilingMs,
  perfBench,
} from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Cost rows of the resource delta copies: one component with many changed
// files (expanded once), and many components in one type directory (listed
// once).

const FILES_2K = 2_000
const FILES_10K = 10_000
const COMPONENTS_2K = 2_000
const COMPONENTS_4K = 4_000
const TO = 'to-sha'
const RESOURCES = 'force-app/main/default/staticresources'

// Seeded from the first ubuntu-latest CI run of these rows (perf-memory.json
// means): a developer-machine mean under-measures CI, so the ceilings come
// from CI only and are re-derived from the gh-pages series once it holds more
// runs.
const WORST_MEAN_MS = {
  'resource-copies-2k-files': 12.76,
  'resource-copies-10k-files': 63.49,
} as const

type CeiledRow = keyof typeof WORST_MEAN_MS

type Budget = (elapsedMs: readonly number[]) => void

// The 2k-components row is the baseline its 4k sibling is bounded against.
const NO_BUDGET: Budget = () => undefined

const metadata = await getDefinition({})

const config: Config = {
  source: sourceDirs('force-app/main/default'),
  output: '/tmp/output',
  generateDelta: true,
  to: TO,
  from: 'from-sha',
  mergeBase: false,
  ignore: '',
  ignoreDestructive: '',
  apiVersion: -1,
  repo: '.',
  ignoreWhitespace: false,
  include: '',
  includeDestructive: '',
}

type Fixture = Readonly<{ trees: TreeReader; buildLines: () => string[] }>

const readerOf = (paths: readonly string[]): TreeReader => {
  const index = new TreeIndex()
  for (const path of paths) index.add(path)
  return createTreeReader(new Map([[TO, index]]))
}

const linesOf = (paths: readonly string[]): string[] =>
  paths.map(path => `${MODIFICATION}${TAB}${path}`)

const libFiles = (fileCount: number): string[] =>
  Array.from({ length: fileCount }, (_, i) => `${RESOURCES}/Lib/f${i}.js`)

const oneFolder = (fileCount: number): Fixture => ({
  trees: readerOf([
    `${RESOURCES}/Lib.resource-meta.xml`,
    ...libFiles(fileCount),
  ]),
  buildLines: () => linesOf(libFiles(fileCount)),
})

const componentFiles = (i: number): string[] => [
  `${RESOURCES}/C${i}/a.js`,
  `${RESOURCES}/C${i}/b.js`,
  `${RESOURCES}/C${i}.resource-meta.xml`,
]

const changedFiles = (componentCount: number): string[] =>
  Array.from({ length: componentCount }, (_, i) => `${RESOURCES}/C${i}/a.js`)

const manyComponents = (componentCount: number): Fixture => ({
  trees: readerOf(
    Array.from({ length: componentCount }, (_, i) => componentFiles(i)).flat()
  ),
  buildLines: () => linesOf(changedFiles(componentCount)),
})

const runRow = (
  name: string,
  { trees, buildLines }: Fixture,
  budget: Budget
): readonly number[] => {
  const ctx = { config, metadata, trees, unions: NO_UNIONS }
  const elapsedMs: number[] = []
  let lines: string[] = []
  describe(name, () => {
    perfBench(
      name,
      async () => {
        const start = performance.now()
        const result = await new DiffLineInterpreter(ctx).process(lines)
        expandComponentCopies(result.copies, trees)
        elapsedMs.push(performance.now() - start)
      },
      {
        afterRun: () => budget(elapsedMs),
        beforeEach: () => {
          lines = buildLines()
        },
      }
    )
  })
  return elapsedMs
}

const withinCeiling =
  (name: CeiledRow): Budget =>
  elapsedMs =>
    assertMeanWithinCeiling(
      name,
      elapsedMs,
      deriveCeilingMs(WORST_MEAN_MS[name])
    )

const linearFrom =
  (name: string, baselineMs: readonly number[], sizeRatio: number): Budget =>
  elapsedMs =>
    assertScalesLinearly(name, baselineMs, elapsedMs, sizeRatio)

runRow(
  'resource-copies-2k-files',
  oneFolder(FILES_2K),
  withinCeiling('resource-copies-2k-files')
)
runRow(
  'resource-copies-10k-files',
  oneFolder(FILES_10K),
  withinCeiling('resource-copies-10k-files')
)
const components2kMs = runRow(
  'resource-copies-2k-components',
  manyComponents(COMPONENTS_2K),
  NO_BUDGET
)
runRow(
  'resource-copies-4k-components',
  manyComponents(COMPONENTS_4K),
  linearFrom(
    'resource-copies-4k-components',
    components2kMs,
    COMPONENTS_4K / COMPONENTS_2K
  )
)
