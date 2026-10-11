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
import { perfBench } from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Cost rows of the resource delta copies (one copy per diff line, expanded
// once per component). Ceilings are NOT set here: rows with no CI history
// are seeded from one ubuntu CI run of this branch (perf-memory.json means),
// never from a local number.

const FILES_2K = 2_000
const FILES_10K = 10_000
const TO = 'to-sha'
const RESOURCES = 'force-app/main/default/staticresources'

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

const runRow = (name: string, fileCount: number) => {
  const trees = buildTrees(fileCount)
  const ctx = { config, metadata, trees, unions: NO_UNIONS }
  let lines: string[] = []
  describe(name, () => {
    perfBench(
      name,
      async () => {
        const result = await new DiffLineInterpreter(ctx).process(lines)
        expandComponentCopies(result.copies, trees)
      },
      {
        beforeEach: () => {
          lines = buildLines(fileCount)
        },
      }
    )
  })
}

runRow('resource-copies-2k-files', FILES_2K)
runRow('resource-copies-10k-files', FILES_10K)
