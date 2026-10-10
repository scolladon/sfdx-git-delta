'use strict'

import { dirname, posix } from 'node:path'

import type GitAdapter from '../adapter/GitAdapter.js'
import { buildScopeMatcher } from '../adapter/pathMatching.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import TypeHandlerFactory from '../service/typeHandlerFactory.js'
import {
  NO_UNIONS,
  type RunContext,
  type UnionOutcomes,
} from '../types/runContext.js'
import { comparisonName } from './comparisonName.js'
import { eachLimit } from './concurrency/index.js'
import { getConcurrencyThreshold } from './concurrencyUtils.js'
import { getErrorMessage } from './errorUtils.js'
import { buildIgnoreHelper, type IgnoreHelper } from './ignoreHelper.js'
import { log } from './LoggingDecorator.js'
import { Logger, lazy } from './LoggingService.js'
import type { DeferredDeletion } from './repoGitDiff.js'
import { loadSfdxProject, type SfdxProject } from './sfdxProject.js'
import { componentListingRoot } from './treeIndexScope.js'

export type MoveResolution = Readonly<{
  lines: readonly string[]
  unions: UnionOutcomes
  checkSkipped: boolean
}>

export type MovePorts = Pick<GitAdapter, 'getBlobIds' | 'getRootFileContent'>

type BlobIds = Awaited<ReturnType<GitAdapter['getBlobIds']>>

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

type SideView = Readonly<{ project: SfdxProject; blobIds: BlobIds }>

type RevisionView = Readonly<{ from: SideView; to: SideView }>

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
): ReadonlyMap<string, string | undefined> => {
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
    private readonly git: MovePorts
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
      const dropped = await this.pureAdditions(
        this.groupMoves(lines, cancelled),
        view,
        ignoreHelper
      )
      return {
        lines: lines.filter(line => !dropped.has(line)),
        unions: NO_UNIONS,
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

  private async loadSide(revision: string): Promise<SideView> {
    const [project, blobIds] = await Promise.all([
      loadSfdxProject(this.git, revision),
      this.git.getBlobIds(revision),
    ])
    return { project, blobIds }
  }

  private async pureAdditions(
    groups: readonly MoveGroup[],
    view: RevisionView,
    ignoreHelper: IgnoreHelper
  ): Promise<ReadonlySet<string>> {
    const probes = await this.probeAll(groups)
    const dropped = new Set<string>()
    const members: string[] = []
    for (const group of groups) {
      if (!this.isPure(group, probes, view, ignoreHelper)) continue
      for (const line of group.additions) dropped.add(line)
      members.push(this.labelOf(group, probes))
    }
    if (members.length > 0) {
      Logger.debug(
        lazy`Pure move(s) suppressed: ${() => members.sort().join(', ')}`
      )
    }
    return dropped
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
