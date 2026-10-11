import { describe } from 'vitest'
import { TreeIndex } from '../../lib/adapter/treeIndex.js'
import { createTreeReader } from '../../lib/adapter/treeReader.js'
import { TAB } from '../../lib/constant/cliConstants.js'
import { MODIFICATION } from '../../lib/constant/gitConstants.js'
import { getDefinition } from '../../lib/metadata/metadataManager.js'
import DiffLineInterpreter from '../../lib/service/diffLineInterpreter.js'
import type { Config } from '../../lib/types/config.js'
import { NO_UNIONS } from '../../lib/types/runContext.js'
import { expandComponentCopies } from '../../lib/utils/componentCopies.js'
import {
  assertMeanWithinCeiling,
  deriveCeilingMs,
  perfBench,
} from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Cost rows of the resource delta copies (one copy per diff line, expanded
// once per component).

const FILES_2K = 2_000
const FILES_10K = 10_000
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

const buildTrees = (fileCount: number) => {
  const index = new TreeIndex()
  index.add(`${RESOURCES}/Lib.resource-meta.xml`)
  for (let i = 0; i < fileCount; i++) {
    index.add(`${RESOURCES}/Lib/f${i}.js`)
  }
  return createTreeReader(new Map([[TO, index]]))
}

const buildLines = (fileCount: number): string[] =>
  Array.from(
    { length: fileCount },
    (_, i) => `${MODIFICATION}${TAB}${RESOURCES}/Lib/f${i}.js`
  )

const runRow = (name: CeiledRow, fileCount: number) => {
  const trees = buildTrees(fileCount)
  const ctx = { config, metadata, trees, unions: NO_UNIONS }
  let lines: string[] = []
  describe(name, () => {
    const elapsedMs: number[] = []
    perfBench(
      name,
      async () => {
        const start = performance.now()
        const result = await new DiffLineInterpreter(ctx).process(lines)
        expandComponentCopies(result.copies, trees)
        elapsedMs.push(performance.now() - start)
      },
      {
        afterRun: () =>
          assertMeanWithinCeiling(
            name,
            elapsedMs,
            deriveCeilingMs(WORST_MEAN_MS[name])
          ),
        beforeEach: () => {
          lines = buildLines(fileCount)
        },
      }
    )
  })
}

runRow('resource-copies-2k-files', FILES_2K)
runRow('resource-copies-10k-files', FILES_10K)
