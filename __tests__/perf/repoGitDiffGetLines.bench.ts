import { describe } from 'vitest'
import type GitAdapter from '../../src/adapter/GitAdapter.js'
import { TAB } from '../../src/constant/cliConstants.js'
import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../src/constant/gitConstants.js'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import type { Config } from '../../src/types/config.js'
import { IgnoreHelper } from '../../src/utils/ignoreHelper.js'
import RepoGitDiff from '../../src/utils/repoGitDiff.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { ROUND_COUNTER_PAD } from './fixtures/generateFixtures.js'
import { buildPath, SHAPES } from './fixtures/registryShapes.js'
import { perfBench } from './harness/perfBench.js'

// Pins the per-line cost of RepoGitDiff.getLines itself: _expandRename,
// _routeLine / _routeAddition (registry membership, ignore check, key
// derivation) and the deferred-deletion tail that runs once the stream is
// drained. It deliberately does not reuse:
//  - pipeline.bench.ts's no-delta pipelines: they diff a real repository, so
//    the git tree walk dominates and a routing regression reads diluted.
//  - cancellationKey.bench.ts: it measures _extractComparisonName alone,
//    not the routing and tail around it.
//  - ignoredAdditionProbe.bench.ts: it measures the held-addition visibility
//    pass, which these streams never reach — nothing here is ignored.

// The seam under measurement: the one git read getLines makes, replaced by a
// synthetic stream so no repository, tsgit diff or tree walk is paid.
class StreamedDiffProbe extends RepoGitDiff {
  declare protected readonly gitAdapter: GitAdapter

  constructor(
    config: Config,
    metadata: MetadataRepository,
    lines: readonly string[]
  ) {
    super(config, metadata)
    this.gitAdapter = {
      async *streamDiffLines() {
        yield* lines
      },
    } as unknown as GitAdapter
  }
}

// Per-line cost is flat from 12.5k to 100k lines, so a larger stream buys no
// extra signal: at 25k a case keeps well inside vitest's 60s bench timeout on
// a CI runner (~2.2x slower than a local run on this path), which 100k does
// not.
const LINE_COUNT = 25_000
const STATUS_ROTATION = [ADDITION, MODIFICATION, DELETION] as const
const LINES_PER_COMPONENT = STATUS_ROTATION.length

type Stream = Readonly<{ lines: readonly string[]; expectedYield: number }>

// One line of a stream, and whether getLines is expected to yield it.
type StreamLine = Readonly<{ line: string; yielded: boolean }>

const padded = (value: number): string =>
  String(value).padStart(ROUND_COUNTER_PAD, '0')

const lineOf = (
  status: string,
  path: string,
  yielded: boolean
): StreamLine => ({
  line: `${status}${TAB}${path}`,
  yielded,
})

// Each component contributes an addition, a modification and a deletion of
// the same shape. Every other deletion names its component's added copy
// from another root — a move getLines must cancel — so the tail both
// cancels and yields.
const mixedLine = (index: number, round: string): StreamLine => {
  const component = Math.floor(index / LINES_PER_COMPONENT)
  const shape = SHAPES[component % SHAPES.length]!
  const status = STATUS_ROTATION[index % LINES_PER_COMPONENT]!
  const movedFromAddition = status === DELETION && component % 2 === 0
  const n = padded(
    movedFromAddition ? index - (LINES_PER_COMPONENT - 1) : index
  )
  const root = movedFromAddition
    ? `force-app/round${round}/moved/default`
    : `force-app/round${round}/main/default`
  return lineOf(status, buildPath(shape, root, n), !movedFromAddition)
}

const deletionLine = (index: number, round: string): StreamLine => {
  const shape = SHAPES[index % SHAPES.length]!
  const root = `force-app/round${round}/main/default`
  return lineOf(DELETION, buildPath(shape, root, padded(index)), true)
}

// Encapsulates the round counter so freshness is an invariant of this one
// generator rather than a module-level mutable a later edit could read out
// of order. Each call renders a brand-new stream: reused line strings carry
// hashes a prior sample already paid for, which a one-shot sgd run never
// amortises. The round number rides one directory segment (`round<N>`) that
// no resolution rule reads, so it cannot change which shape a path resolves
// to. It is shared by the whole stream rather than varied per line: the
// ignore matcher memoises every parent directory, so a unique directory per
// line would make it pay for a directory per line a real diff never has.
const createFreshStream = (
  lineAt: (index: number, round: string) => StreamLine
) => {
  let round = 0
  return (): Stream => {
    round += 1
    const lines: string[] = []
    let expectedYield = 0
    for (let index = 0; index < LINE_COUNT; index++) {
      const { line, yielded } = lineAt(index, padded(round))
      lines.push(line)
      if (yielded) expectedYield += 1
    }
    return { lines, expectedYield }
  }
}

// Built once: RepoGitDiff's constructor only pools a lazily-opened
// GitAdapter singleton by repo path (see GitAdapter.getInstance), which the
// probe then replaces, so a shared config touches no disk.
const baseConfig: Config = {
  to: 'HEAD',
  from: 'HEAD~1',
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: process.cwd(),
  ignoreWhitespace: false,
  generateDelta: false,
}

const STREAMS = [
  ['mixed-amd', mixedLine],
  ['all-deletions', deletionLine],
] as const

describe('repo-git-diff-get-lines', () => {
  for (const [name, lineAt] of STREAMS) {
    const nextStream = createFreshStream(lineAt)
    let probe: StreamedDiffProbe | undefined
    let expectedYield = 0
    const yieldedCounts: number[] = []
    perfBench(
      `get-lines-${name}-${LINE_COUNT}-lines`,
      async () => {
        let yielded = 0
        for await (const _line of probe!.getLines()) yielded += 1
        yieldedCounts.push(yielded)
      },
      {
        // A brand-new registry and ignore matcher per sample keep their path
        // caches cold, as for a fresh sgd() invocation; a matcher kept across
        // samples memoises every path it has seen and slows each later
        // sample down. The registry is built here, outside the timed window;
        // getLines builds the matcher itself.
        beforeEach: async () => {
          IgnoreHelper.resetIgnoreInstance()
          const metadata = await getDefinition({})
          const stream = nextStream()
          probe = new StreamedDiffProbe(baseConfig, metadata, stream.lines)
          expectedYield = stream.expectedYield
        },
        // A stream the registry rejected would drain in no time and report
        // a flattering number; every sample must have routed the lines.
        afterRun: () => {
          const unexpected = yieldedCounts.filter(
            count => count !== expectedYield
          )
          if (yieldedCounts.length === 0 || unexpected.length > 0) {
            throw new Error(
              `get-lines-${name} expected ${expectedYield} yielded lines per sample, got ${JSON.stringify([...new Set(yieldedCounts)])}`
            )
          }
        },
      }
    )
  }
})
