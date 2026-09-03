import ignore from 'ignore'
import { bench, describe } from 'vitest'
import { TAB } from '../../src/constant/cliConstants.js'
import { ADDITION } from '../../src/constant/gitConstants.js'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import type { Config } from '../../src/types/config.js'
import { IgnoreHelper } from '../../src/utils/ignoreHelper.js'
import RepoGitDiff from '../../src/utils/repoGitDiff.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { buildPath, SHAPES } from './fixtures/registryShapes.js'

// Pins the cost of the visibility pass the fix introduced: one linear walk
// over every in-scope file at `to`, doing a registry-membership check plus
// key derivation per path, and an ignore check only on candidate hits. This
// bench deliberately does not reuse gitAdapter.bench.ts's approach of
// diffing this very repository's own history — that grows with every commit
// landed on a feature branch and is self-referential rather than a stable
// ceiling. It walks a synthetic listing instead: no repository, no tsgit
// flatten, no trie — those are GitAdapter's own costs and are bounded by
// gitAdapter.bench.ts on a real repository.

// The seam under measurement: the visibility pass over a `to` listing,
// reached through `protected` from a subclass that replaces the one git
// read with a synthetic listing — no repository, no tsgit flatten, no trie.
class VisibilityProbe extends RepoGitDiff {
  constructor(
    config: Config,
    metadata: MetadataRepository,
    private readonly listing: readonly string[]
  ) {
    super(config, metadata)
  }

  protected override async _listFilesAt(): Promise<
    readonly string[] | undefined
  > {
    return this.listing
  }

  public key(line: string): string {
    return this._extractComparisonName(line)
  }

  public visible(
    candidates: ReadonlySet<string>,
    ignoreHelper: IgnoreHelper
  ): Promise<ReadonlySet<string>> {
    return this._visibleNamesAtTo(candidates, ignoreHelper)
  }
}

const LISTING_SIZES = [10_000, 50_000] as const
const PER_PATH_BUDGET_US = 3
// Shared runners are noisy (±40 % run-to-run is normal); the ceiling exists
// to catch an order-of-magnitude regression, not to police variance.
// It fails `npm run test:perf` locally (a throwing bench yields no samples
// and the results formatter rejects that), but the CI perf job is
// continue-on-error, so it blocks nothing there.
const RUNNER_NOISE_FACTOR = 3
const ROUND_COUNTER_PAD = 9
const IGNORE_PATTERNS = ['force-app/recycle-bin/', '**/__tests__/**', '*.bak']

const assertWithinCeiling = (
  label: string,
  elapsedMs: number,
  ceilingMs: number
): void => {
  if (elapsedMs > ceilingMs) {
    throw new Error(
      `${label} took ${elapsedMs.toFixed(2)}ms, exceeding the ${ceilingMs}ms noise-tolerant ceiling`
    )
  }
}

// Encapsulates the round counter so freshness is an invariant of this one
// generator rather than a module-level mutable a later edit could read out
// of order. Each call renders a brand-new listing: reused path strings let a
// Map lookup's key benefit from work a prior call already paid for on that
// exact string, biasing the reading toward whichever side happens to
// memoize on the caller's own string — this is what most of a spurious
// +66% reading on a prior measurement traced back to. The round number
// rides a directory segment (`round<N>`) that no resolution rule reads:
// extension lookups never see it and the directory walk only matches
// *known* segment names, so it cannot change which shape a path resolves
// to.
const createFreshListing = (size: number) => {
  let round = 0
  return (): { listing: string[]; candidatePaths: string[] } => {
    round += 1
    const listing: string[] = []
    const candidatePaths: string[] = []
    for (let index = 0; index < size; index++) {
      const shape = SHAPES[index % SHAPES.length]!
      const n = String(round * size + index).padStart(ROUND_COUNTER_PAD, '0')
      const path = buildPath(shape, `force-app/round${n}/main/default`, n)
      listing.push(path)
      if (index < SHAPES.length) candidatePaths.push(path)
    }
    return { listing, candidatePaths }
  }
}

// Built once: RepoGitDiff's constructor only pools a lazily-opened
// GitAdapter singleton by repo path (see GitAdapter.getInstance) and never
// touches disk, so a shared config costs nothing that the ≤3x budget is
// about.
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

// No temp file, no singleton: the IgnoreHelper public constructor takes the
// two `ignore()` instances directly.
const ignoreHelper = new IgnoreHelper(ignore().add(IGNORE_PATTERNS), ignore())

const ceilingMs = (size: number): number =>
  (size * PER_PATH_BUDGET_US * RUNNER_NOISE_FACTOR) / 1000

describe('ignored-addition-probe-cold-registry', () => {
  for (const size of LISTING_SIZES) {
    const nextRound = createFreshListing(size)
    bench(`visibility-pass-cold-${size}-paths`, async () => {
      // Cold per round: a brand-new registry means pathCache starts empty,
      // so every lookup below pays the full miss cost a fresh sgd()
      // invocation pays — the cost getLines() cannot amortise away for a
      // one-shot CLI run.
      const metadata = await getDefinition({})
      const { listing, candidatePaths } = nextRound()
      const probe = new VisibilityProbe(baseConfig, metadata, listing)
      const candidates = new Set(
        candidatePaths.map(path => probe.key(`${ADDITION}${TAB}${path}`))
      )
      const start = performance.now()
      await probe.visible(candidates, ignoreHelper)
      assertWithinCeiling(
        `visibility pass over ${size} paths`,
        performance.now() - start,
        ceilingMs(size)
      )
    })
  }
})
