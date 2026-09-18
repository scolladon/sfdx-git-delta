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
  packageXml: string
  destructiveXml: string
}> => {
  const input = await makeInput(overrides)
  const work = await sgd(input)
  const packageXml = await readFile(
    join(input.output, 'package', 'package.xml'),
    'utf8'
  )
  const destructiveXml = await readFile(
    join(input.output, 'destructiveChanges', 'destructiveChanges.xml'),
    'utf8'
  )
  return { work, packageXml, destructiveXml }
}

const members = (manifest: Manifest, type: string): string[] =>
  [...(manifest.get(type) ?? [])].sort()

// Both halves must share identical overrides: IgnoreHelper caches its
// singleton on first call regardless of arguments, so the `off` and `on`
// runs below share one cached helper.
const runBothModes = async (
  overrides: Partial<ConfigInput> = {}
): Promise<{
  off: Awaited<ReturnType<typeof runSgd>>
  on: Awaited<ReturnType<typeof runSgd>>
  payload: ChangesManifestJson
}> => {
  const off = await runSgd(overrides)
  const changesManifest = join(
    await trackedTempDir('sgd-folder-move-manifest-'),
    'changes.manifest.json'
  )
  const on = await runSgd({ ...overrides, changesManifest })
  const payload = JSON.parse(
    await readFile(changesManifest, 'utf8')
  ) as ChangesManifestJson
  return { off, on, payload }
}

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

describe('Given a report folder move', () => {
  it('When a report moves between folders, Then destructiveChanges.xml carries no member for it', async () => {
    // Act
    const { destructiveXml } = await runSgd()

    // Assert — the positive member pins the writer itself, so a truncated or
    // empty document cannot satisfy the two negatives alone.
    expect(destructiveXml).toContain('<members>OldFolder/My_Report_C</members>')
    expect(destructiveXml).not.toContain('OldFolder/My_Report_A')
    expect(destructiveXml).not.toContain('OldFolder/My_Report_B')
  })

  it('When the folder move lands, Then only the report whose DeveloperName also changed keeps its former path', async () => {
    // Act
    const { work } = await runSgd()

    // Assert — one exact set states the whole partition: the two pure moves
    // are dropped, and My_Report_C survives because the deploy cannot match
    // My_Report_C_Renamed back to it. A pair of negatives would also pass on
    // an empty manifest produced by a broken pipeline.
    expect(members(work.changes.forDestructiveManifest(), 'Report')).toEqual([
      'OldFolder/My_Report_C',
    ])
  })

  it('When a report moves between folders, Then the package manifest carries its new path', async () => {
    // Act
    const { work } = await runSgd()

    // Assert — the new path is what performs the move on deploy.
    expect(members(work.changes.forPackageManifest(), 'Report')).toEqual([
      'NewFolder/My_Report_A',
      'NewFolder/My_Report_B',
      'NewFolder/My_Report_C_Renamed',
    ])
  })

  it('When a report moves between folders, Then the review view agrees with the destructive manifest', async () => {
    // Act
    const { work } = await runSgd()

    // Assert — the two public views must never disagree about a suppression.
    expect(
      members(work.changes.byChangeKind()[ChangeKind.Delete], 'Report')
    ).toEqual(['OldFolder/My_Report_C'])
  })

  it('When the emptied report folder is deleted, Then the folder descriptor still emits', async () => {
    // Act
    const { work } = await runSgd()

    // Assert — a folder is not relocated by the deploy, so it really goes.
    expect(
      members(work.changes.forDestructiveManifest(), 'ReportFolder')
    ).toEqual(['OldFolder'])
  })
})

describe('Given a dashboard folder move', () => {
  it('When the folder move lands, Then only the dashboard whose DeveloperName also changed keeps its former path', async () => {
    // Act
    const { work } = await runSgd()

    // Assert — same partition as the report case: My_Dash is a pure move and
    // is dropped, My_Dash2 became My_Dash2_Renamed and so really is deleted.
    expect(members(work.changes.forDestructiveManifest(), 'Dashboard')).toEqual(
      ['OldDash/My_Dash2']
    )
  })

  it('When a dashboard moves between folders, Then the package manifest carries its new path', async () => {
    // Act
    const { work } = await runSgd()

    // Assert
    expect(members(work.changes.forPackageManifest(), 'Dashboard')).toEqual([
      'NewDash/My_Dash',
      'NewDash/My_Dash2_Renamed',
    ])
  })

  it('When the emptied dashboard folder is deleted, Then the folder descriptor still emits', async () => {
    // Act
    const { work } = await runSgd()

    // Assert
    expect(
      members(work.changes.forDestructiveManifest(), 'DashboardFolder')
    ).toEqual(['OldDash'])
  })
})

describe('Given a document folder move', () => {
  it('When a document moves between folders, Then its former path still emits', async () => {
    // Act
    const { work } = await runSgd()

    // Assert — move-on-deploy is documented for reports and dashboards only,
    // so a document really is destroyed at its former path.
    expect(members(work.changes.forDestructiveManifest(), 'Document')).toEqual([
      'OldDocFolder/My_Doc',
    ])
  })
})

describe('Given an email template folder move', () => {
  it('When an email template moves between folders, Then its former path still emits', async () => {
    // Act
    const { work } = await runSgd()

    // Assert
    expect(
      members(work.changes.forDestructiveManifest(), 'EmailTemplate')
    ).toEqual(['OldEmailFolder/My_Tpl'])
  })
})

describe('Given a report and dashboard folder move reported through a changes manifest', () => {
  const runWithManifest = async (): Promise<{
    work: Awaited<ReturnType<typeof sgd>>
    payload: ChangesManifestJson
  }> => {
    const changesManifest = join(
      await trackedTempDir('sgd-folder-move-manifest-'),
      'changes.manifest.json'
    )
    const { work } = await runSgd({ changesManifest })
    const payload = JSON.parse(
      await readFile(changesManifest, 'utf8')
    ) as ChangesManifestJson
    return { work, payload }
  }

  it('When --changes-manifest is set, Then a moved report still has its former path dropped', async () => {
    // Act
    const { work } = await runWithManifest()

    // Assert — rename detection is on in this mode, so the former path also
    // arrives as a rename source; it must be dropped there too.
    expect(members(work.changes.forDestructiveManifest(), 'Report')).toEqual([
      'OldFolder/My_Report_C',
    ])
  })

  it('When --changes-manifest is set, Then a moved dashboard still has its former path dropped', async () => {
    // Act
    const { work } = await runWithManifest()

    // Assert
    expect(members(work.changes.forDestructiveManifest(), 'Dashboard')).toEqual(
      ['OldDash/My_Dash2']
    )
  })

  it('When --changes-manifest is set, Then the rename bucket still reports every moved report', async () => {
    // Act
    const { payload } = await runWithManifest()

    // Assert — suppression is a manifest concern; the move itself must stay
    // fully reported.
    expect(payload[ChangeKind.Rename]['Report']).toEqual([
      { from: 'OldFolder/My_Report_A', to: 'NewFolder/My_Report_A' },
      { from: 'OldFolder/My_Report_B', to: 'NewFolder/My_Report_B' },
      { from: 'OldFolder/My_Report_C', to: 'NewFolder/My_Report_C_Renamed' },
    ])
  })

  it('When --changes-manifest is set, Then a renamed report appears in the rename bucket only', async () => {
    // Act
    const { payload } = await runWithManifest()

    // Assert — this characterises the bucket partition, NOT the folder-move
    // suppression: in this mode the former paths are rename sources that the
    // exact subtraction removes before suppression is ever consulted. The
    // add-bucket line is the one doing work — it pins the rename-target
    // subtraction, which nothing else here covers.
    expect(payload[ChangeKind.Delete]['Report']).toBeUndefined()
    expect(payload[ChangeKind.Add]['Report']).toBeUndefined()
  })
})

describe('Given a report whose DeveloperName equals its own folder name', () => {
  it('When the folder is collapsed into the move destination, Then the folder deletion still emits', async () => {
    // Act
    const { work } = await runSgd({ to: refs.folderCollapse })

    // Assert — the folder and the report are distinct types, so naming them
    // alike cannot make the folder's deletion look like a relocation.
    expect(
      members(work.changes.forDestructiveManifest(), 'ReportFolder')
    ).toEqual(['Foo'])
  })

  it('When the folder is collapsed into the move destination, Then the report keeps no destructive member', async () => {
    // Act
    const { work } = await runSgd({ to: refs.folderCollapse })

    // Assert
    expect(work.changes.forDestructiveManifest().has('Report')).toBe(false)
  })

  it('When the folder is collapsed into the move destination, Then the package manifest carries the new report and folder', async () => {
    // Act
    const { work } = await runSgd({ to: refs.folderCollapse })

    // Assert
    const pkg = work.changes.forPackageManifest()
    expect(members(pkg, 'Report')).toEqual(['Bar/Foo'])
    expect(members(pkg, 'ReportFolder')).toEqual(['Bar'])
  })
})

describe('Given a report moved into a globally ignored path', () => {
  it('When --ignore-file covers the move destination, Then the source deletion survives for every moved report', async () => {
    // Arrange — _buildIgnore reads this with a plain fs.readFile, which
    // resolves a relative path against process.cwd(), so config.ignore must
    // get an absolute path. Kept out of the shared fixture repo so no test
    // mutates it after beforeAll.
    const ignore = join(
      await trackedTempDir('sgd-folder-move-ignore-'),
      '.sgdignore-new-folder'
    )
    await writeFile(ignore, 'force-app/main/default/reports/NewFolder/\n')

    // Act
    const { work } = await runSgd({ ignore })

    // Assert — a report moved into an ignored path keeps its deletion: the
    // destination never reaches the package view, so nothing vouches for it.
    expect(members(work.changes.forDestructiveManifest(), 'Report')).toEqual([
      'OldFolder/My_Report_A',
      'OldFolder/My_Report_B',
      'OldFolder/My_Report_C',
    ])
  })
})

describe('Given a report folder move reported through a changes manifest and a destructive ignore covering the source folder', () => {
  const sourceFolderIgnoreOverrides = async (): Promise<
    Partial<ConfigInput>
  > => {
    // Arrange — _buildIgnore reads this with a plain fs.readFile, which
    // resolves a relative path against process.cwd(), so config.ignoreDestructive
    // must get an absolute path.
    const ignoreDestructive = join(
      await trackedTempDir('sgd-folder-move-ignore-'),
      '.sgdignore-old-folder'
    )
    await writeFile(
      ignoreDestructive,
      'force-app/main/default/reports/OldFolder/\n'
    )
    return { ignoreDestructive }
  }

  it('When the run runs in both modes, Then the destructive view drops every report while the folder descriptor and the dashboard survive as controls', async () => {
    // Arrange
    const overrides = await sourceFolderIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert — the folder descriptor and the untouched dashboard prove the
    // run really produced a destructive view, so an empty Report bucket
    // cannot be explained by a broken pipeline.
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forDestructiveManifest(), 'Report')
      ).toEqual([])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ReportFolder')
      ).toEqual(['OldFolder'])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'Dashboard')
      ).toEqual(['OldDash/My_Dash2'])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it', async () => {
    // Arrange
    const overrides = await sourceFolderIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
  })

  it('When the run also reports a changes manifest, Then every report relocates to the add bucket instead of surviving as a rename or a deletion', async () => {
    // Arrange
    const overrides = await sourceFolderIgnoreOverrides()

    // Act
    const { payload } = await runBothModes(overrides)

    // Assert — every Report triple's source lies under the ignored folder,
    // so all three drop whatever tsgit's blob pairing produced; the
    // surviving targets resurface as plain adds instead.
    expect(payload[ChangeKind.Rename]['Report']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['Report']).toBeUndefined()
    expect([...payload[ChangeKind.Add]['Report']].sort()).toEqual([
      'NewFolder/My_Report_A',
      'NewFolder/My_Report_B',
      'NewFolder/My_Report_C_Renamed',
    ])
  })
})

describe('Given a report folder move reported through a changes manifest and a global ignore covering the destination folder', () => {
  const destinationFolderIgnoreOverrides = async (): Promise<
    Partial<ConfigInput>
  > => {
    // Arrange — same absolute-path requirement as the destructive side, and
    // the same pattern the no-flag case above already runs.
    const ignore = join(
      await trackedTempDir('sgd-folder-move-ignore-'),
      '.sgdignore-new-folder'
    )
    await writeFile(ignore, 'force-app/main/default/reports/NewFolder/\n')
    return { ignore }
  }

  it('When the run runs in both modes, Then the package view drops every report while the folder descriptor survives as a control', async () => {
    // Arrange
    const overrides = await destinationFolderIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'Report')
      ).toEqual([])
      expect(
        members(result.work.changes.forPackageManifest(), 'ReportFolder')
      ).toEqual(['NewFolder'])
    }
  })

  it('When the run also reports a changes manifest, Then the destructive view matches what the run without it already keeps', async () => {
    // Arrange
    const overrides = await destinationFolderIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert — the rename target no longer reaches the package view, so it
    // can no longer vouch for the source path's deletion. Comparing against
    // the same run with the flag omitted (rather than a copied literal)
    // pins this to the answer the no-flag case above already establishes.
    const offReports = members(
      off.work.changes.forDestructiveManifest(),
      'Report'
    )
    // Guard the equality below: without this the assertion would also pass
    // if both runs produced nothing at all.
    expect(offReports).toHaveLength(3)
    expect(members(on.work.changes.forDestructiveManifest(), 'Report')).toEqual(
      offReports
    )
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it', async () => {
    // Arrange
    const overrides = await destinationFolderIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
  })
})
