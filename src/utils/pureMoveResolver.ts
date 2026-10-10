'use strict'

import { dirname, posix } from 'node:path'

import type GitAdapter from '../adapter/GitAdapter.js'
import { buildScopeMatcher } from '../adapter/pathMatching.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import { getInFileAttributes } from '../metadata/metadataManager.js'
import TypeHandlerFactory from '../service/typeHandlerFactory.js'
import {
  NO_UNIONS,
  type RunContext,
  type UnionOutcomes,
} from '../types/runContext.js'
import { comparisonName } from './comparisonName.js'
import { eachLimit } from './concurrency/index.js'
import { getConcurrencyThreshold } from './concurrencyUtils.js'
import {
  buildUnionSpec,
  type RevisionSide,
  unionScopeOf,
} from './containerUnion.js'
import { getErrorMessage } from './errorUtils.js'
import { buildIgnoreHelper, type IgnoreHelper } from './ignoreHelper.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import MetadataDiff, { type DiffOutcome } from './metadataDiff/index.js'
import type { DeferredDeletion } from './repoGitDiff.js'
import {
  loadSfdxProject,
  type PackageDirectoryKey,
  type SfdxProject,
} from './sfdxProject.js'
import { componentListingRoot } from './treeIndexScope.js'

export type MoveResolution = Readonly<{
  lines: readonly string[]
  unions: UnionOutcomes
  checkSkipped: boolean
}>

export type MovePorts = Pick<GitAdapter, 'getBlobIds' | 'getRootFileContent'>

type BlobIds = RevisionSide['blobIds']

export type UnionDiffPort = Pick<MetadataDiff, 'runUnion'>

type Probe = Readonly<{
  type: string
  member: string
  comparesElements: boolean
}>

type MoveGroup = Readonly<{
  name: string
  deletions: readonly string[]
  additions: readonly string[]
}>

type MovedPaths = Pick<MoveGroup, 'deletions' | 'additions'>

type RevisionView = Readonly<{ from: RevisionSide; to: RevisionSide }>

type UnionTriggers = Map<string, Map<PackageDirectoryKey, Set<string>>>

type Judgement = Readonly<{
  dropped: Set<string>
  triggers: UnionTriggers
}>

type UnionTarget = Readonly<{
  scope: string
  entry: PackageDirectoryKey
  listingRoots: readonly string[]
}>

type UnionResult = Readonly<{
  outcomes: Map<string, DiffOutcome>
  dropped: Set<string>
}>

const groupByEntry = (
  paths: readonly string[],
  project: SfdxProject
): ReadonlyMap<PackageDirectoryKey, readonly string[]> => {
  const grouped = new Map<PackageDirectoryKey, string[]>()
  for (const path of paths) {
    const entry = project.packageDirectoryOf(path)
    grouped.set(entry, [...(grouped.get(entry) ?? []), path])
  }
  return grouped
}

const pathOf = (line: string): string => line.replace(GIT_DIFF_TYPE_REGEX, '')

const commonDirectory = (paths: readonly string[]): string =>
  paths
    .map(path => dirname(path).split('/'))
    .reduce((shared, segments) =>
      shared.filter((segment, index) => segments[index] === segment)
    )
    .join('/')

const relativePaths = (paths: readonly string[]): readonly string[] => {
  const root = commonDirectory(paths)
  return paths.map(path => posix.relative(root, path)).sort()
}

const blobIdsByRelativePath = (
  paths: readonly string[],
  blobIds: BlobIds
): ReadonlyMap<string, unknown> => {
  const root = commonDirectory(paths)
  return new Map(
    paths.map(path => [posix.relative(root, path), blobIds.get(path)])
  )
}

const sameIdentity = (probes: readonly Probe[]): boolean =>
  probes.every(
    probe =>
      probe.type === probes[0]!.type && probe.member === probes[0]!.member
  )

const sameEntry = (group: MovedPaths, view: RevisionView): boolean => {
  const entries = new Set([
    ...group.deletions.map(path => view.from.project.packageDirectoryOf(path)),
    ...group.additions.map(path => view.to.project.packageDirectoryOf(path)),
  ])
  return entries.size === 1
}

const sameSet = (
  found: readonly string[],
  expected: readonly string[]
): boolean => {
  const wanted = new Set(expected)
  return found.length === wanted.size && found.every(path => wanted.has(path))
}

const sameContent = (group: MovedPaths, view: RevisionView): boolean => {
  const before = blobIdsByRelativePath(group.deletions, view.from.blobIds)
  const after = blobIdsByRelativePath(group.additions, view.to.blobIds)
  const sameShape =
    relativePaths(group.deletions).join('\0') ===
    relativePaths(group.additions).join('\0')
  return (
    sameShape &&
    [...before].every(
      ([path, id]) => id !== undefined && id === after.get(path)
    )
  )
}

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
      return { lines, unions: NO_UNIONS, checkSkipped: false }
    }
    try {
      const [view, ignoreHelper] = await Promise.all([
        this.loadView(),
        buildIgnoreHelper(this.ctx.config),
      ])
      const groups = this.groupMoves(lines, cancelled)
      const probes = await this.probeAll(groups)
      const judged = this.judge(groups, probes, view, ignoreHelper)
      const unions = await this.diffUnions(
        judged.triggers,
        lines,
        view,
        ignoreHelper
      )
      const dropped = new Set([...judged.dropped, ...unions.dropped])
      return {
        lines: lines.filter(line => !dropped.has(line)),
        unions: unions.outcomes,
        checkSkipped: false,
      }
    } catch (error) {
      Logger.debug(
        lazy`Pure move check skipped: ${() => getErrorMessage(error)}`
      )
      return { lines, unions: NO_UNIONS, checkSkipped: true }
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
    for (const { line, name } of cancelled) {
      const group = groups.get(name) ?? { name, deletions: [], additions: [] }
      group.deletions.push(line)
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

  private judge(
    groups: readonly MoveGroup[],
    probes: ReadonlyMap<string, Probe>,
    view: RevisionView,
    ignoreHelper: IgnoreHelper
  ): Judgement {
    const dropped = new Set<string>()
    const triggers: UnionTriggers = new Map()
    const members: string[] = []
    for (const group of groups) {
      if (this.isPure(group, probes, view, ignoreHelper)) {
        for (const line of group.additions) dropped.add(line)
        members.push(this.labelOf(group, probes))
        continue
      }
      this.collectTriggers(group, probes, view, ignoreHelper, triggers)
    }
    if (members.length > 0) {
      Logger.debug(
        lazy`Pure move(s) suppressed: ${() => members.sort().join(', ')}`
      )
    }
    return { dropped, triggers }
  }

  private collectTriggers(
    group: MoveGroup,
    probes: ReadonlyMap<string, Probe>,
    view: RevisionView,
    ignoreHelper: IgnoreHelper,
    triggers: UnionTriggers
  ): void {
    const known = this.probesOf(group, probes)
    if (!known?.some(probe => probe.comparesElements)) return
    const deletions = group.deletions.map(pathOf)
    const scope = unionScopeOf(deletions[0]!, this.ctx.metadata)
    const added = groupByEntry(group.additions.map(pathOf), view.to.project)
    const visible = deletions.filter(path => this.isKept(path, ignoreHelper))
    for (const [entry, old] of groupByEntry(visible, view.from.project)) {
      const arrived = added.get(entry)
      if (!arrived) continue
      const roots = this.listingRoots({ deletions: old, additions: arrived })
      if (roots) this.record(triggers, scope, entry, roots)
    }
  }

  private record(
    triggers: UnionTriggers,
    scope: string,
    entry: PackageDirectoryKey,
    roots: readonly string[]
  ): void {
    const entries = triggers.get(scope) ?? new Map()
    const known: Set<string> = entries.get(entry) ?? new Set()
    for (const root of roots) known.add(root)
    entries.set(entry, known)
    triggers.set(scope, entries)
  }

  private async diffUnions(
    triggers: UnionTriggers,
    lines: readonly string[],
    view: RevisionView,
    ignoreHelper: IgnoreHelper
  ): Promise<UnionResult> {
    const result: UnionResult = { outcomes: new Map(), dropped: new Set() }
    for (const [scope, entries] of triggers) {
      for (const [entry, roots] of entries) {
        await this.diffEntry(
          { scope, entry, listingRoots: [...roots].sort() },
          { lines, view, ignoreHelper },
          result
        )
      }
    }
    return result
  }

  private async diffEntry(
    target: UnionTarget,
    context: Readonly<{
      lines: readonly string[]
      view: RevisionView
      ignoreHelper: IgnoreHelper
    }>,
    result: UnionResult
  ): Promise<void> {
    const spec = buildUnionSpec({
      ...target,
      metadata: this.ctx.metadata,
      source: this.ctx.config.source,
      ignore: context.ignoreHelper,
      from: context.view.from,
      to: context.view.to,
      lines: context.lines,
    })
    try {
      const outcomes = await this.unionDiff.runUnion(spec)
      for (const [path, outcome] of outcomes) result.outcomes.set(path, outcome)
      for (const line of spec.droppedDeletions) result.dropped.add(line)
      Logger.debug(
        lazy`Union diff of ${target.scope} in ${String(target.entry)}: ${spec.memberPaths.length} member(s)`
      )
    } catch (error) {
      Logger.debug(
        lazy`Union diff of ${target.scope} in ${String(target.entry)} kept as is: ${() => getErrorMessage(error)}`
      )
    }
  }

  private labelOf(
    group: MoveGroup,
    probes: ReadonlyMap<string, Probe>
  ): string {
    const { type, member } = probes.get(group.deletions[0]!)!
    return `${type}:${member}`
  }

  private async probeAll(
    groups: readonly MoveGroup[]
  ): Promise<ReadonlyMap<string, Probe>> {
    const probes = new Map<string, Probe>()
    const lines = groups.flatMap(group => [
      ...group.deletions,
      ...group.additions,
    ])
    await eachLimit(lines, getConcurrencyThreshold(), async line => {
      try {
        const handler = await this.factory.getTypeHandler(line)
        probes.set(line, {
          ...handler.getElementDescriptor(),
          comparesElements: handler.comparesElements(),
        })
      } catch (error) {
        Logger.debug(
          lazy`Pure move probe failed for ${line}: ${() => getErrorMessage(error)}`
        )
      }
    })
    return probes
  }

  private isPure(
    group: MoveGroup,
    probes: ReadonlyMap<string, Probe>,
    view: RevisionView,
    ignoreHelper: IgnoreHelper
  ): boolean {
    const known = this.probesOf(group, probes)
    if (!known || !sameIdentity(known)) return false
    if (known.some(probe => probe.comparesElements)) return false
    const moved = {
      deletions: group.deletions.map(pathOf),
      additions: group.additions.map(pathOf),
    }
    return (
      moved.deletions.every(path => this.isKept(path, ignoreHelper)) &&
      sameEntry(moved, view) &&
      this.isComplete(group.name, moved, view, ignoreHelper) &&
      sameContent(moved, view)
    )
  }

  private isKept(path: string, ignoreHelper: IgnoreHelper): boolean {
    return ignoreHelper.keep(`${ADDITION}${TAB}${path}`)
  }

  private isComplete(
    name: string,
    moved: MovedPaths,
    view: RevisionView,
    ignoreHelper: IgnoreHelper
  ): boolean {
    const roots = this.listingRoots(moved)
    if (!roots) return false
    const listed = (blobIds: BlobIds): string[] =>
      this.listComponent(name, blobIds, roots, ignoreHelper)
    return (
      sameSet(listed(view.from.blobIds), moved.deletions) &&
      sameSet(listed(view.to.blobIds), moved.additions)
    )
  }

  private listingRoots(moved: MovedPaths): readonly string[] | undefined {
    const roots: string[] = []
    for (const path of [...moved.deletions, ...moved.additions]) {
      const root = componentListingRoot(path, this.ctx.metadata)
      if (root === null) return undefined
      roots.push(root)
    }
    return roots
  }

  private listComponent(
    name: string,
    blobIds: BlobIds,
    roots: readonly string[],
    ignoreHelper: IgnoreHelper
  ): string[] {
    const inRoots = buildScopeMatcher(roots)
    const inSource = buildScopeMatcher(this.ctx.config.source)
    return [...blobIds.keys()].filter(path => {
      if (!inRoots(path) || !inSource(path)) return false
      const line = `${ADDITION}${TAB}${path}`
      return (
        this.ctx.metadata.has(line) &&
        ignoreHelper.keep(line) &&
        comparisonName(this.ctx.metadata, line) === name
      )
    })
  }

  private probesOf(
    group: MoveGroup,
    probes: ReadonlyMap<string, Probe>
  ): readonly Probe[] | undefined {
    const found: Probe[] = []
    for (const line of [...group.deletions, ...group.additions]) {
      const probe = probes.get(line)
      if (!probe) return undefined
      found.push(probe)
    }
    return found
  }
}
