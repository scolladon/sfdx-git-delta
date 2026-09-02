import { bench, describe } from 'vitest'
import { TAB } from '../../src/constant/cliConstants.js'
import { ADDITION } from '../../src/constant/gitConstants.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import type { Config } from '../../src/types/config.js'
import RepoGitDiff from '../../src/utils/repoGitDiff.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'

// Pins the cost of deriving a cancellation key on a COLD registry — the
// worst case getLines() actually pays once per sgd() invocation. It
// deliberately does not reuse:
//  - phase.bench.ts: one MetadataRepository built at module load and reused
//    across every sample, over paths pre-stripped of their diff-status
//    prefix. Both choices are exactly what a registry-lookup or line-shape
//    regression would hide behind: warm pathCache, no prefix to strip.
//  - gitAdapter.bench.ts: diffs this very repository's own `HEAD~20..HEAD`,
//    which grows with every commit landed on a feature branch and is
//    self-referential rather than a stable ceiling.
// Comparing this bench's number against the same file run over `main` (no
// such file exists there, so the comparison happens in a throwaway checkout)
// is what evidences the key-derivation budget.

// The seam under measurement: RepoGitDiff._extractComparisonName, exercised
// the way getLines() calls it — through a subclass, never by reaching past
// `protected`.
class CancellationKeyProbe extends RepoGitDiff {
  public key(line: string): string {
    return this._extractComparisonName(line)
  }
}

// One path shape per branch MetadataRepositoryImpl's getFullyQualifiedName
// actually takes: a plain type (extension lookup only), a content container
// (bundle adapter, stops at its directory), a folder-organised type, a
// nested-content type sharing one flat directory with siblings told apart
// by suffix, a composed type whose children are decomposed under their
// holder, and a holder-scoped composed type whose every file keys on the
// holder itself.
type Shape =
  | 'plain-type'
  | 'content-container'
  | 'in-folder-type'
  | 'nested-content-type'
  | 'composed-type'
  | 'holder-scoped-type'

const SHAPES: readonly Shape[] = [
  'plain-type',
  'content-container',
  'in-folder-type',
  'nested-content-type',
  'composed-type',
  'holder-scoped-type',
]

const buildPath = (shape: Shape, root: string, n: string): string => {
  switch (shape) {
    case 'plain-type':
      return `${root}/classes/MyClass${n}.cls`
    case 'content-container':
      return `${root}/lwc/myComponent${n}/myComponent${n}.js`
    case 'in-folder-type':
      return `${root}/reports/Sales${n}/Sales${n}.report-meta.xml`
    case 'nested-content-type':
      return `${root}/bots/MyBot${n}/v${n}.botVersion`
    case 'composed-type':
      return `${root}/objects/Account${n}/fields/MyField${n}.field-meta.xml`
    case 'holder-scoped-type':
      return `${root}/permissionsets/PS${n}/objectSettings/Account.objectSettings-meta.xml`
  }
}

// A single registry build (tens of microseconds, paid once per round below)
// would otherwise swamp the per-line signal this bench exists to catch: the
// rule under test costs low hundreds of nanoseconds per line, so a round of
// only one line per shape spends most of its time on registry construction,
// not on the code being measured. Repeating one shape this many times per
// round keeps the registry build below a twentieth of the round, so a
// regression in the key reads at close to its true multiple instead of being
// diluted — without abandoning a cold registry.
const LINES_PER_ROUND = 1500
// Wide enough that the counter never outgrows its padding over a whole
// benchmark run, so every sample keys a path of constant length.
const ROUND_COUNTER_PAD = 7

// Encapsulates the round counter so freshness is an invariant of this one
// generator rather than a module-level mutable a later edit could read out
// of order. Each call renders one shape into a brand-new set of lines:
// reused line strings let a Map lookup's key benefit from work a prior call
// already paid for on that exact string, biasing the reading toward
// whichever side happens to memoize on the caller's own string — this is
// what most of a spurious +66% reading on a prior measurement traced back
// to. The round number rides a directory segment (`round<N>`) that no
// resolution rule reads: extension lookups never see it and the directory
// walk only matches *known* segment names, so it cannot change which shape
// a line resolves to.
const createFreshLinesForShape = (shape: Shape) => {
  let round = 0
  return (): string[] => {
    round += 1
    const lines: string[] = []
    for (let repeat = 0; repeat < LINES_PER_ROUND; repeat++) {
      const n = String(round * LINES_PER_ROUND + repeat).padStart(
        ROUND_COUNTER_PAD,
        '0'
      )
      const root = `force-app/round${n}/main/default`
      lines.push(`${ADDITION}${TAB}${buildPath(shape, root, n)}`)
    }
    return lines
  }
}

// Built once: RepoGitDiff's constructor only pools a lazily-opened
// GitAdapter singleton by repo path (see GitAdapter.getInstance) and never
// touches disk or the pathCache this bench measures, so a shared config
// costs nothing that the ≤3x budget is about.
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

describe('cancellation-key-cold-registry', () => {
  for (const shape of SHAPES) {
    const nextRoundLines = createFreshLinesForShape(shape)
    bench(`cancellation-key-derivation-cold-${shape}`, async () => {
      // Cold per round: a brand-new registry means pathCache starts empty,
      // so every lookup below pays the full miss cost a fresh sgd()
      // invocation pays on its very first line — the cost getLines() cannot
      // amortise away for a one-shot CLI run.
      const metadata = await getDefinition({})
      const probe = new CancellationKeyProbe(baseConfig, metadata)
      for (const line of nextRoundLines()) {
        probe.key(line)
      }
    })
  }
})
