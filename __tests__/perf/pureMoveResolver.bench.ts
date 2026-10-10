import { rm } from 'node:fs/promises'
import { afterAll, describe } from 'vitest'
import GitAdapter from '../../lib/adapter/GitAdapter.js'
import { TAB } from '../../lib/constant/cliConstants.js'
import { ADDITION, DELETION } from '../../lib/constant/gitConstants.js'
import { getDefinition } from '../../lib/metadata/metadataManager.js'
import type { Config } from '../../lib/types/config.js'
import { NO_UNIONS, type RunContext } from '../../lib/types/runContext.js'
import { comparisonName } from '../../lib/utils/comparisonName.js'
import PureMoveResolver, {
  type MovePorts,
} from '../../lib/utils/pureMoveResolver.js'
import type { DeferredDeletion } from '../../lib/utils/repoGitDiff.js'
import { createTempDir } from '../__utils__/gitTestHarness.ts'
import { buildLabelsUnionRepo } from './fixtures/labelsUnionRepoFixture.ts'
import { perfBench } from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Cost rows of the pure-move check (design cost model). Ceilings are NOT set
// here: a bench with no CI history is seeded from one CI run of its branch,
// never from a local number.

// Not 2k: the check scans the whole revision listing once per moved group, so
// one resolve at 2k components takes ~25s and the 64-sample budget cannot
// finish inside vitest's bench timeout.
const COMPONENT_COUNT = 100
const NO_CANDIDATE_LINES = 10_000
const LABELS_FILES = 20
const LABELS_PER_FILE = 250
const OBJECT_ID = 'blob-id'

const baseConfig: Config = {
  to: 'to',
  from: 'from',
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: process.cwd(),
  ignoreWhitespace: false,
  generateDelta: false,
}

const metadata = await getDefinition({})
const contextOf = (config: Config): RunContext => ({
  config,
  metadata,
  trees: undefined as never,
  unions: NO_UNIONS,
})

const classPaths = (root: string, index: number): string[] => [
  `${root}/classes/Cls${index}.cls`,
  `${root}/classes/Cls${index}.cls-meta.xml`,
]

const OLD_ROOT = 'force-app/old/main/default'
const NEW_ROOT = 'force-app/new/main/default'

type Scenario = Readonly<{
  lines: string[]
  cancelled: DeferredDeletion[]
  from: Map<string, string>
  to: Map<string, string>
}>

// Fresh strings and maps per call: the blob-id maps are the cold state a
// real run pays for, and reused instances would memoise lookups.
const createScenario = (movedCount: number, editedCount: number) => {
  let round = 0
  return (): Scenario => {
    round += 1
    const lines: string[] = []
    const cancelled: DeferredDeletion[] = []
    const from = new Map<string, string>()
    const to = new Map<string, string>()
    for (let index = 0; index < movedCount + editedCount; index++) {
      const edited = index >= movedCount
      const id = `${OBJECT_ID}-${round}-${index}`
      for (const path of classPaths(OLD_ROOT, index)) {
        const target = path.replace(OLD_ROOT, NEW_ROOT)
        from.set(path, id)
        to.set(target, edited ? `${id}-edited` : id)
        const deletion = `${DELETION}${TAB}${path}`
        const addition = `${ADDITION}${TAB}${target}`
        lines.push(addition)
        cancelled.push({
          line: deletion,
          name: comparisonName(metadata, deletion),
        })
      }
    }
    return { lines, cancelled, from, to }
  }
}

const portsOf = (scenario: Scenario): MovePorts =>
  ({
    getBlobIds: async (revision: string) =>
      revision === baseConfig.from ? scenario.from : scenario.to,
    getRootFileContent: async () => undefined,
  }) as unknown as MovePorts

const runScenario = (name: string, movedCount: number, editedCount: number) =>
  describe(name, () => {
    const nextRound = createScenario(movedCount, editedCount)
    let scenario: Scenario
    let sut: PureMoveResolver
    perfBench(
      name,
      async () => {
        await sut.resolve(scenario.lines, scenario.cancelled)
      },
      {
        beforeEach: () => {
          scenario = nextRound()
          sut = new PureMoveResolver(contextOf(baseConfig), portsOf(scenario))
        },
      }
    )
  })

describe('pure-move-resolver-no-candidate', () => {
  const lines = Array.from(
    { length: NO_CANDIDATE_LINES },
    (_, index) => `${ADDITION}${TAB}${classPaths(OLD_ROOT, index)[0]}`
  )
  const sut = new PureMoveResolver(
    contextOf(baseConfig),
    portsOf({ lines, cancelled: [], from: new Map(), to: new Map() })
  )
  perfBench('no-candidate-10k-lines', async () => {
    await sut.resolve(lines, [])
  })
})

runScenario('pure-move-100-components', COMPONENT_COUNT, 0)
runScenario(
  'mixed-moves-and-edits-100',
  COMPONENT_COUNT / 2,
  COMPONENT_COUNT / 2
)

const REPO_ROOT = await createTempDir('sgd-bench-labels-union-')
const refs = buildLabelsUnionRepo(REPO_ROOT, LABELS_FILES, LABELS_PER_FILE)

describe('pure-move-resolver-labels-union', () => {
  const config: Config = {
    ...baseConfig,
    from: refs.from,
    to: refs.to,
    repo: REPO_ROOT,
  }
  const addition = `${ADDITION}${TAB}${refs.movedTo}`
  const deletion = `${DELETION}${TAB}${refs.movedFrom}`
  const cancelled: DeferredDeletion[] = [
    { line: deletion, name: comparisonName(metadata, deletion) },
  ]
  let sut: PureMoveResolver

  afterAll(async () => {
    await GitAdapter.closeAll()
    await rm(REPO_ROOT, { recursive: true, force: true })
  })

  perfBench(
    'labels-union-20-files-5k-labels',
    async () => {
      await sut.resolve([addition], cancelled)
    },
    {
      beforeEach: async () => {
        await GitAdapter.closeAll()
        sut = new PureMoveResolver(
          contextOf(config),
          GitAdapter.getInstance(config)
        )
      },
    }
  )
})
