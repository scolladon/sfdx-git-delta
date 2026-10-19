'use strict'

import type GitAdapter from '../adapter/GitAdapter.js'
import { ADDITION } from '../constant/gitConstants.js'
import { getInFileAttributes } from '../metadata/metadataManager.js'
import TypeHandlerFactory from '../service/typeHandlerFactory.js'
import {
  NO_UNIONS,
  type RunContext,
  type UnionOutcomes,
} from '../types/runContext.js'
import { comparisonName } from './comparisonName.js'
import {
  type Candidate,
  candidateOf,
  indexComponents,
  isPure,
  type MoveEnv,
  type MoveGroup,
  type Probe,
  spansEntries,
} from './componentMove.js'
import { eachLimit } from './concurrency/index.js'
import { getConcurrencyThreshold } from './concurrencyUtils.js'
import {
  buildUnionSpec,
  listUnionCandidates,
  type UnionListing,
} from './containerUnion.js'
import { getErrorMessage } from './errorUtils.js'
import { buildIgnoreHelper } from './ignoreHelper.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import MetadataDiff, { type DiffOutcome } from './metadataDiff/index.js'
import type { DeferredDeletion } from './repoGitDiff.js'
import { type RevisionSide, type RevisionView } from './revisionSide.js'
import { loadSfdxProject } from './sfdxProject.js'
import {
  toUnionTargets,
  triggersOf,
  type UnionTarget,
  type UnionTrigger,
} from './unionTriggers.js'

export type MoveResolution = Readonly<{
  lines: readonly string[]
  unions: UnionOutcomes
  skipCause: string | undefined
}>

export type MovePorts = Pick<GitAdapter, 'getBlobIds' | 'getRootFileContent'>

export type UnionDiffPort = Pick<MetadataDiff, 'runUnion'>

type Judgement = Readonly<{
  dropped: ReadonlySet<string>
  triggers: readonly UnionTrigger[]
}>

type UnionResult = Readonly<{
  outcomes: ReadonlyMap<string, DiffOutcome>
  dropped: ReadonlySet<string>
}>

type DiffContext = Readonly<{
  lines: readonly string[]
  view: RevisionView
  env: MoveEnv
  listing: UnionListing
}>

const NO_RESULT: UnionResult = { outcomes: new Map(), dropped: new Set() }

const linesOf = (group: MoveGroup): readonly string[] => [
  ...group.deletions,
  ...group.additions,
]

const mergeResults = (results: readonly UnionResult[]): UnionResult => ({
  outcomes: new Map(results.flatMap(result => [...result.outcomes])),
  dropped: new Set(results.flatMap(result => [...result.dropped])),
})

export default class PureMoveResolver {
  private readonly factory: TypeHandlerFactory

  constructor(
    private readonly ctx: RunContext,
    private readonly git: MovePorts,
    private readonly unionDiff: UnionDiffPort = new MetadataDiff(
      ctx.config,
      getInFileAttributes(ctx.metadata)
    )
  ) {
    this.factory = new TypeHandlerFactory(ctx)
  }

  @log
  public async resolve(
    lines: readonly string[],
    cancelled: readonly DeferredDeletion[]
  ): Promise<MoveResolution> {
    if (cancelled.length === 0) {
      return { lines, unions: NO_UNIONS, skipCause: undefined }
    }
    try {
      return await this.suppress(lines, cancelled)
    } catch (error) {
      const cause = getErrorMessage(error)
      Logger.debug(lazy`Pure move check skipped: ${cause}`)
      return { lines, unions: NO_UNIONS, skipCause: cause }
    }
  }

  private async suppress(
    lines: readonly string[],
    cancelled: readonly DeferredDeletion[]
  ): Promise<MoveResolution> {
    const [view, ignore] = await Promise.all([
      this.loadView(),
      buildIgnoreHelper(this.ctx.config),
    ])
    const env: MoveEnv = {
      metadata: this.ctx.metadata,
      source: this.ctx.config.source,
      ignore,
    }
    const groups = this.groupMoves(lines, cancelled)
    const probes = await this.probeAll(groups, view)
    const judged = this.judge(groups, probes, view, env)
    const unions = await this.diffUnions(judged.triggers, { lines, view, env })
    const dropped = new Set([...judged.dropped, ...unions.dropped])
    return {
      lines: lines.filter(line => !dropped.has(line)),
      unions: unions.outcomes,
      skipCause: undefined,
    }
  }

  private groupMoves(
    lines: readonly string[],
    cancelled: readonly DeferredDeletion[]
  ): readonly MoveGroup[] {
    const groups = new Map<
      string,
      { name: string; deletions: string[]; additions: string[] }
    >()
    // A line determines its name, so one set de-duplicates across groups.
    const seen = new Set<string>()
    for (const { line, name } of cancelled) {
      const group = groups.get(name) ?? { name, deletions: [], additions: [] }
      // Rename detection may report one deleted source once per identical
      // destination, yet it is one deleted file.
      if (!seen.has(line)) {
        seen.add(line)
        group.deletions.push(line)
      }
      groups.set(name, group)
    }
    for (const line of lines) {
      if (line.charAt(0) !== ADDITION) continue
      groups.get(comparisonName(this.ctx.metadata, line))?.additions.push(line)
    }
    return [...groups.values()]
  }

  private async loadView(): Promise<RevisionView> {
    const [from, to] = await Promise.all([
      this.loadSide(this.ctx.config.from),
      this.loadSide(this.ctx.config.to),
    ])
    return { from, to }
  }

  private async loadSide(revision: string): Promise<RevisionSide> {
    const [project, blobIds] = await Promise.all([
      loadSfdxProject(this.git, revision),
      this.git.getBlobIds(revision),
    ])
    return { project, blobIds }
  }

  // A group spanning package directories is never a pure move; only an
  // element-comparing handler still needs its lines for union triggers, and a
  // group's lines share one handler, so one line tells which case it is.
  private async probeAll(
    groups: readonly MoveGroup[],
    view: RevisionView
  ): Promise<ReadonlyMap<string, Probe>> {
    const probes = new Map<string, Probe>()
    const spanning = new Set(groups.filter(group => spansEntries(group, view)))
    const local = groups.filter(group => !spanning.has(group))
    await this.probeLines(
      [
        ...local.flatMap(linesOf),
        ...[...spanning].flatMap(group => linesOf(group).slice(0, 1)),
      ],
      probes
    )
    const comparing = [...spanning].filter(group =>
      linesOf(group)
        .slice(0, 1)
        .some(line => probes.get(line)?.comparesElements)
    )
    await this.probeLines(
      comparing.flatMap(group => linesOf(group).slice(1)),
      probes
    )
    return probes
  }

  private async probeLines(
    lines: readonly string[],
    probes: Map<string, Probe>
  ): Promise<void> {
    await eachLimit(lines, getConcurrencyThreshold(), async line => {
      const probe = await this.probe(line)
      if (probe) probes.set(line, probe)
    })
  }

  private async probe(line: string): Promise<Probe | undefined> {
    try {
      const handler = await this.factory.getTypeHandler(line)
      return {
        ...handler.getElementDescriptor(),
        comparesElements: handler.comparesElements(),
      }
    } catch (error) {
      Logger.debug(
        lazy`Pure move probe failed for ${line}: ${() => getErrorMessage(error)}`
      )
      return undefined
    }
  }

  private judge(
    groups: readonly MoveGroup[],
    probes: ReadonlyMap<string, Probe>,
    view: RevisionView,
    env: MoveEnv
  ): Judgement {
    const candidates = this.candidatesOf(groups, probes, view, env)
    const indexes = indexComponents([...candidates.values()], view, env)
    const pure = [...candidates].filter(([group, candidate]) =>
      isPure(group.name, candidate, view, indexes)
    )
    const pureGroups = new Set(pure.map(([group]) => group))
    const labels = pure.map(([, candidate]) => candidate.label)
    if (labels.length > 0) {
      Logger.debug(
        lazy`Pure move(s) suppressed: ${() => [...labels].sort().join(', ')}`
      )
    }
    return {
      dropped: new Set(pure.flatMap(([group]) => group.additions)),
      triggers: groups
        .filter(group => !pureGroups.has(group))
        .flatMap(group => triggersOf(group, probes, view, env)),
    }
  }

  private candidatesOf(
    groups: readonly MoveGroup[],
    probes: ReadonlyMap<string, Probe>,
    view: RevisionView,
    env: MoveEnv
  ): ReadonlyMap<MoveGroup, Candidate> {
    return new Map(
      groups.flatMap((group): [MoveGroup, Candidate][] => {
        const candidate = candidateOf(group, probes, view, env)
        return candidate ? [[group, candidate]] : []
      })
    )
  }

  private async diffUnions(
    triggers: readonly UnionTrigger[],
    base: Omit<DiffContext, 'listing'>
  ): Promise<UnionResult> {
    const targets = toUnionTargets(triggers)
    if (targets.length === 0) return NO_RESULT
    const listing = listUnionCandidates(
      {
        metadata: base.env.metadata,
        source: base.env.source,
        from: base.view.from,
        to: base.view.to,
        lines: base.lines,
      },
      targets
    )
    const results: UnionResult[] = []
    for (const target of targets) {
      results.push(await this.diffEntry(target, { ...base, listing }))
    }
    return mergeResults(results)
  }

  private specOf(
    target: UnionTarget,
    { lines, view, env, listing }: DiffContext
  ) {
    return buildUnionSpec(
      { ...target, ...env, from: view.from, to: view.to, lines },
      listing
    )
  }

  private async diffEntry(
    target: UnionTarget,
    context: DiffContext
  ): Promise<UnionResult> {
    const spec = this.specOf(target, context)
    const label = `${target.scope} in ${String(target.entry)}`
    try {
      const outcomes = await this.unionDiff.runUnion(spec)
      Logger.debug(
        lazy`Union diff of ${label}: ${spec.memberPaths.length} member(s)`
      )
      return { outcomes, dropped: new Set(spec.droppedDeletions) }
    } catch (error) {
      Logger.debug(
        lazy`Union diff of ${label} kept as is: ${() => getErrorMessage(error)}`
      )
      return NO_RESULT
    }
  }
}
