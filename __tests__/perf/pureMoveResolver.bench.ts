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
  type UnionDiffPort,
} from '../../lib/utils/pureMoveResolver.js'
import type { DeferredDeletion } from '../../lib/utils/repoGitDiff.js'
import { createTempDir } from '../__utils__/gitTestHarness.ts'
import { buildLabelsUnionRepo } from './fixtures/labelsUnionRepoFixture.ts'
import {
  assertMeanWithinCeiling,
  deriveCeilingMs,
  perfBench,
} from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

// Cost rows of the pure-move check (design cost model). Ceilings are NOT set
// here: a bench with no CI history is seeded from one CI run of its branch,
// never from a local number.

const COMPONENT_COUNT = 2000
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

const portsOf = (
  scenario: Scenario,
  rootFile: string | undefined = undefined
): MovePorts =>
  ({
    getBlobIds: async (revision: string) =>
      revision === baseConfig.from ? scenario.from : scenario.to,
    getRootFileContent: async () => rootFile,
  }) as unknown as MovePorts

// Seeded from the first ubuntu-latest CI run of these rows (perf-memory.json
// means): a developer-machine mean under-measures CI, so the ceilings come
// from CI only and are re-derived from the gh-pages series once it holds more
// runs. no-candidate-10k-lines has no ceiling: its sub-microsecond mean is
// dominated by timer noise, so any ceiling would only measure the runner.
const WORST_MEAN_MS = {
  'pure-move-2k-components': 97.02,
  'mixed-moves-and-edits-2k': 96.58,
  'pure-move-1-in-50k-tree': 51.92,
  'container-moves-200-in-20k-tree': 25.28,
  'one-folder-component-2k-files-moved': 69.25,
  'labels-union-20-files-5k-labels': 106.31,
} as const

type CeiledRow = keyof typeof WORST_MEAN_MS

const ceiled = (name: CeiledRow) => {
  const elapsedMs: number[] = []
  return {
    timed: async (run: () => Promise<unknown>): Promise<void> => {
      const start = performance.now()
      await run()
      elapsedMs.push(performance.now() - start)
    },
    afterRun: () =>
      assertMeanWithinCeiling(
        name,
        elapsedMs,
        deriveCeilingMs(WORST_MEAN_MS[name])
      ),
  }
}

const runScenario = (
  name: CeiledRow,
  movedCount: number,
  editedCount: number
) =>
  describe(name, () => {
    const nextRound = createScenario(movedCount, editedCount)
    const ceiling = ceiled(name)
    let scenario: Scenario
    let sut: PureMoveResolver
    perfBench(
      name,
      async () => {
        await ceiling.timed(() =>
          sut.resolve(scenario.lines, scenario.cancelled)
        )
      },
      {
        afterRun: ceiling.afterRun,
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

runScenario('pure-move-2k-components', COMPONENT_COUNT, 0)
runScenario(
  'mixed-moves-and-edits-2k',
  COMPONENT_COUNT / 2,
  COMPONENT_COUNT / 2
)

const TREE_SIZE = 50_000
const STATIC_RESOURCE_FILES = 10_000
const CONTAINER_TREE_SIZE = 20_000
const MOVED_WORKFLOWS = 200
const SHARED_ROOT = 'force-app/main/default'
const WORKFLOW_NEW_ROOT = 'force-app/sales'
const SFDX_PROJECT = JSON.stringify({
  packageDirectories: [{ path: 'force-app' }],
})

const unrelatedTree = (size: number, round: number): Map<string, string> => {
  const tree = new Map<string, string>()
  for (let index = 0; tree.size < size; index++) {
    tree.set(`${SHARED_ROOT}/classes/Other${index}.cls`, `o-${round}-${index}`)
    tree.set(
      `${SHARED_ROOT}/objects/O${index % 500}/fields/F${index}.field-meta.xml`,
      `f-${round}-${index}`
    )
  }
  return tree
}

const largeTreeScenario = (): (() => Scenario) => {
  let round = 0
  return () => {
    round += 1
    const from = unrelatedTree(TREE_SIZE, round)
    for (let index = 0; index < STATIC_RESOURCE_FILES; index++) {
      from.set(`${SHARED_ROOT}/staticresources/Lib/f${index}.js`, `s-${index}`)
    }
    from.set(`${SHARED_ROOT}/staticresources/Lib.resource-meta.xml`, 'meta')
    const to = new Map(from)
    const moved = createScenario(1, 0)()
    for (const [path, id] of moved.from) from.set(path, id)
    for (const [path, id] of moved.to) to.set(path, id)
    return { ...moved, from, to }
  }
}

describe('pure-move-resolver-large-tree', () => {
  const nextRound = largeTreeScenario()
  let scenario: Scenario
  let sut: PureMoveResolver
  const ceiling = ceiled('pure-move-1-in-50k-tree')
  perfBench(
    'pure-move-1-in-50k-tree',
    async () => {
      await ceiling.timed(() => sut.resolve(scenario.lines, scenario.cancelled))
    },
    {
      afterRun: ceiling.afterRun,
      beforeEach: () => {
        scenario = nextRound()
        sut = new PureMoveResolver(contextOf(baseConfig), portsOf(scenario))
      },
    }
  )
})

const containerScenario = (): (() => Scenario) => {
  let round = 0
  return () => {
    round += 1
    const from = unrelatedTree(CONTAINER_TREE_SIZE, round)
    const to = new Map(from)
    const lines: string[] = []
    const cancelled: DeferredDeletion[] = []
    for (let index = 0; index < MOVED_WORKFLOWS; index++) {
      const name = `Wf${index}.workflow-meta.xml`
      const oldPath = `${SHARED_ROOT}/workflows/${name}`
      const newPath = `${WORKFLOW_NEW_ROOT}/workflows/${name}`
      const deletion = `${DELETION}${TAB}${oldPath}`
      from.set(oldPath, `w-${round}-${index}`)
      to.set(newPath, `w-${round}-${index}-edited`)
      lines.push(`${ADDITION}${TAB}${newPath}`)
      cancelled.push({
        line: deletion,
        name: comparisonName(metadata, deletion),
      })
    }
    return { lines, cancelled, from, to }
  }
}

describe('pure-move-resolver-container-moves', () => {
  const nextRound = containerScenario()
  const unionDiff: UnionDiffPort = { runUnion: async () => new Map() }
  let scenario: Scenario
  let sut: PureMoveResolver
  const ceiling = ceiled('container-moves-200-in-20k-tree')
  perfBench(
    'container-moves-200-in-20k-tree',
    async () => {
      await ceiling.timed(() => sut.resolve(scenario.lines, scenario.cancelled))
    },
    {
      afterRun: ceiling.afterRun,
      beforeEach: () => {
        scenario = nextRound()
        sut = new PureMoveResolver(
          contextOf(baseConfig),
          portsOf(scenario, SFDX_PROJECT),
          unionDiff
        )
      },
    }
  )
})

// Sized so the fixed iteration budget stays well inside the bench timeout on
// the slower CI runners; the cost per file is linear.
const FOLDER_FILES = 2_000

const moveFolderFile = (scenario: Scenario, name: string, id: string): void => {
  const oldPath = `${OLD_ROOT}/staticresources/${name}`
  const newPath = `${NEW_ROOT}/staticresources/${name}`
  const deletion = `${DELETION}${TAB}${oldPath}`
  scenario.from.set(oldPath, id)
  scenario.to.set(newPath, id)
  scenario.lines.push(`${ADDITION}${TAB}${newPath}`)
  scenario.cancelled.push({
    line: deletion,
    name: comparisonName(metadata, deletion),
  })
}

const folderScenario = (): (() => Scenario) => {
  let round = 0
  return () => {
    round += 1
    const from = unrelatedTree(CONTAINER_TREE_SIZE, round)
    const scenario: Scenario = {
      lines: [],
      cancelled: [],
      from,
      to: new Map(from),
    }
    moveFolderFile(scenario, 'Lib.resource-meta.xml', `m-${round}`)
    for (let index = 0; index < FOLDER_FILES; index++) {
      moveFolderFile(scenario, `Lib/f${index}.js`, `s-${round}-${index}`)
    }
    return scenario
  }
}

const sanityScenario = folderScenario()()
const sanity = await new PureMoveResolver(
  contextOf(baseConfig),
  portsOf(sanityScenario)
).resolve(sanityScenario.lines, sanityScenario.cancelled)
if (sanity.lines.length > 0) {
  throw new Error('The folder move bench must be a fully suppressed move')
}

describe('pure-move-resolver-folder-component', () => {
  const nextRound = folderScenario()
  let scenario: Scenario
  let sut: PureMoveResolver
  const ceiling = ceiled('one-folder-component-2k-files-moved')
  perfBench(
    'one-folder-component-2k-files-moved',
    async () => {
      await ceiling.timed(() => sut.resolve(scenario.lines, scenario.cancelled))
    },
    {
      afterRun: ceiling.afterRun,
      beforeEach: () => {
        scenario = nextRound()
        sut = new PureMoveResolver(contextOf(baseConfig), portsOf(scenario))
      },
    }
  )
})

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

  const ceiling = ceiled('labels-union-20-files-5k-labels')
  perfBench(
    'labels-union-20-files-5k-labels',
    async () => {
      await ceiling.timed(() => sut.resolve([addition], cancelled))
    },
    {
      afterRun: ceiling.afterRun,
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
