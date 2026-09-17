'use strict'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { ChangeKind } from '../../src/types/handlerResult'
import type { Manifest } from '../../src/types/work'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  buildFolderMoveFixtureRepo,
  FIXTURE_HOOK_BUDGET_MS,
  type FolderMoveFixtureRefs,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// Mirrors the private shape ChangesManifestProcessor writes to disk, so the
// rename-bucket assertions below can read the file back typed rather than as
// `unknown`.
type RenamePairJson = { from: string; to: string }
type ChangesManifestJson = {
  [ChangeKind.Add]: Record<string, string[]>
  [ChangeKind.Modify]: Record<string, string[]>
  [ChangeKind.Delete]: Record<string, string[]>
  [ChangeKind.Rename]: Record<string, RenamePairJson[]>
}

// makeInput pins apiVersion, so ConfigValidator's appexchange lookup is never
// reached for any run built through it — this bucket runs behind an
// unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60

let fixtureDir: string
let refs: FolderMoveFixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const makeInput = async (
  overrides: Partial<ConfigInput> = {}
): Promise<ConfigInput> => ({
  to: refs.moved,
  from: refs.root,
  mergeBase: false,
  output: await trackedTempDir('sgd-folder-move-out-'),
  source: ['force-app'],
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  apiVersion: API_VERSION,
  ...overrides,
})

const runSgd = async (
  overrides: Partial<ConfigInput> = {}
): Promise<{
  work: Awaited<ReturnType<typeof sgd>>
  destructiveXml: string
}> => {
  const input = await makeInput(overrides)
  const work = await sgd(input)
  const destructiveXml = await readFile(
    join(input.output, 'destructiveChanges', 'destructiveChanges.xml'),
    'utf8'
  )
  return { work, destructiveXml }
}

const members = (manifest: Manifest, type: string): string[] =>
  [...(manifest.get(type) ?? [])].sort()

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-folder-move-fixture-')
  refs = buildFolderMoveFixtureRepo(fixtureDir)
  // A dozen-ish plumbing commits; the default 10s hook timeout has a
  // documented Windows-runner flake of exactly this shape.
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
  IgnoreHelper.resetIgnoreInstance()
  IgnoreHelper.resetIncludeInstance()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a report and dashboard folder move', () => {
  it('When sgd runs in default mode, Then the destructive manifest keeps only the true deletions, drops the DeveloperName-matched survivors, folder descriptors still delete, Document/EmailTemplate folder moves still emit, and the review view agrees', async () => {
    // Act
    const { work, destructiveXml } = await runSgd()

    // Assert
    const destructive = work.changes.forDestructiveManifest()
    const pkg = work.changes.forPackageManifest()

    expect(members(destructive, 'Report')).toEqual(['OldFolder/My_Report_C'])
    expect(destructiveXml).not.toContain('OldFolder/My_Report_A')
    expect(members(pkg, 'Report')).toEqual([
      'NewFolder/My_Report_A',
      'NewFolder/My_Report_B',
      'NewFolder/My_Report_C_Renamed',
    ])

    expect(members(destructive, 'Dashboard')).toEqual(['OldDash/My_Dash2'])
    expect(members(pkg, 'Dashboard')).toEqual([
      'NewDash/My_Dash',
      'NewDash/My_Dash2_Renamed',
    ])

    expect(members(destructive, 'Document')).toEqual(['OldDocFolder/My_Doc'])
    expect(members(destructive, 'EmailTemplate')).toEqual([
      'OldEmailFolder/My_Tpl',
    ])

    expect(members(destructive, 'ReportFolder')).toEqual(['OldFolder'])
    expect(members(destructive, 'DashboardFolder')).toEqual(['OldDash'])

    expect(
      members(work.changes.byChangeKind()[ChangeKind.Delete], 'Report')
    ).toEqual(['OldFolder/My_Report_C'])
  })

  it('When --changes-manifest is set, Then the destructive manifest still keeps only the true deletions, the JSON rename bucket keeps every Report pair, and the JSON delete bucket drops Report entirely', async () => {
    // Arrange
    const changesManifest = join(
      await trackedTempDir('sgd-folder-move-manifest-'),
      'changes.manifest.json'
    )

    // Act
    const { work } = await runSgd({ changesManifest })
    const payload = JSON.parse(
      await readFile(changesManifest, 'utf8')
    ) as ChangesManifestJson

    // Assert
    const destructive = work.changes.forDestructiveManifest()
    expect(members(destructive, 'Report')).toEqual(['OldFolder/My_Report_C'])
    expect(members(destructive, 'Dashboard')).toEqual(['OldDash/My_Dash2'])

    expect(payload[ChangeKind.Rename]['Report']).toEqual([
      { from: 'OldFolder/My_Report_A', to: 'NewFolder/My_Report_A' },
      { from: 'OldFolder/My_Report_B', to: 'NewFolder/My_Report_B' },
      { from: 'OldFolder/My_Report_C', to: 'NewFolder/My_Report_C_Renamed' },
    ])
    expect(payload[ChangeKind.Delete]['Report']).toBeUndefined()
  })
})

describe('Given a report whose DeveloperName equals its own folder name', () => {
  it('When the folder is collapsed into the move destination, Then the ReportFolder deletion still emits and the report is not double-classified', async () => {
    // Act
    const { work } = await runSgd({ to: refs.folderCollapse })

    // Assert
    const destructive = work.changes.forDestructiveManifest()
    const pkg = work.changes.forPackageManifest()
    expect(members(destructive, 'ReportFolder')).toEqual(['Foo'])
    expect(destructive.has('Report')).toBe(false)
    expect(members(pkg, 'Report')).toEqual(['Bar/Foo'])
    expect(members(pkg, 'ReportFolder')).toEqual(['Bar'])
  })
})

describe('Given a report moved into a globally ignored path', () => {
  it('When --ignore-file covers the move destination, Then the source deletion survives for every moved report', async () => {
    // Arrange — _buildIgnore reads this with a plain fs.readFile, which
    // resolves a relative path against process.cwd() rather than the
    // fixture directory, so the path handed to config.ignore must be
    // absolute.
    const ignore = join(fixtureDir, '.sgdignore-new-folder')
    await writeFile(ignore, 'force-app/main/default/reports/NewFolder/\n')

    // Act
    const { work } = await runSgd({ ignore })

    // Assert — a Report moved into a globally-ignored path keeps its
    // deletion: the fail-safe direction is preserved.
    expect(members(work.changes.forDestructiveManifest(), 'Report')).toEqual([
      'OldFolder/My_Report_A',
      'OldFolder/My_Report_B',
      'OldFolder/My_Report_C',
    ])
  })
})
