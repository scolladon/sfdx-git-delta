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
  buildRenameIgnoreFixtureRepo,
  FIXTURE_HOOK_BUDGET_MS,
  RENAME_IGNORE_ARCHIVE_ROOT,
  RENAME_IGNORE_BAR_CLASS,
  RENAME_IGNORE_BAR_META,
  RENAME_IGNORE_FOO_CLASS,
  RENAME_IGNORE_FOO_META,
  type RenameIgnoreFixtureRefs,
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
let refs: RenameIgnoreFixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const writePatterns = async (
  name: string,
  patterns: string
): Promise<string> => {
  // _buildIgnore reads this with a plain fs.readFile, which resolves a
  // relative path against process.cwd(), so the path handed to config must
  // be absolute.
  const file = join(await trackedTempDir('sgd-rename-ignore-patterns-'), name)
  await writeFile(file, patterns)
  return file
}

const makeInput = async (
  overrides: Partial<ConfigInput> = {}
): Promise<ConfigInput> => ({
  to: refs.classRename,
  from: refs.root,
  mergeBase: false,
  output: await trackedTempDir('sgd-rename-ignore-out-'),
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
    await trackedTempDir('sgd-rename-ignore-manifest-'),
    'changes.manifest.json'
  )
  const on = await runSgd({ ...overrides, changesManifest })
  const payload = JSON.parse(
    await readFile(changesManifest, 'utf8')
  ) as ChangesManifestJson
  return { off, on, payload }
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-rename-ignore-fixture-')
  refs = buildRenameIgnoreFixtureRepo(fixtureDir)
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

describe('Given an ApexClass rename and no ignore file', () => {
  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it', async () => {
    // Act
    const { off, on } = await runBothModes()

    // Assert — the control: proves the harness itself before anything about
    // the ignore gate is claimed.
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
    expect(members(off.work.changes.forPackageManifest(), 'ApexClass')).toEqual(
      ['Bar']
    )
    expect(
      members(off.work.changes.forDestructiveManifest(), 'ApexClass')
    ).toEqual(['Foo'])
  })
})

describe('Given an ApexClass rename whose source a destructive ignore covers', () => {
  const destructiveIgnoreOverrides = async (): Promise<
    Partial<ConfigInput>
  > => ({
    ignoreDestructive: await writePatterns(
      '.sgdignore-destructive-foo',
      `${RENAME_IGNORE_FOO_CLASS}\n${RENAME_IGNORE_FOO_META}\n`
    ),
  })

  it('When the run runs in both modes, Then the destructive member is gone and the package member survives', async () => {
    // Arrange
    const overrides = await destructiveIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert — the positive half stops an empty/truncated manifest from
    // satisfying the negative alone.
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual([])
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual(['Bar'])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it', async () => {
    // Arrange
    const overrides = await destructiveIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
  })

  it('When the run also reports a changes manifest, Then the rename source relocates to the add bucket instead of surviving as a rename', async () => {
    // Arrange
    const overrides = await destructiveIgnoreOverrides()

    // Act
    const { payload } = await runBothModes(overrides)

    // Assert
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Add]['ApexClass']).toEqual(['Bar'])
  })
})

describe('Given an ApexClass rename whose target a global ignore covers', () => {
  const globalIgnoreOverrides = async (): Promise<Partial<ConfigInput>> => ({
    ignore: await writePatterns(
      '.sgdignore-global-bar',
      `${RENAME_IGNORE_BAR_CLASS}\n${RENAME_IGNORE_BAR_META}\n`
    ),
  })

  it('When the run runs in both modes, Then the package member is gone and the destructive member survives', async () => {
    // Arrange
    const overrides = await globalIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual([])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual(['Foo'])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it', async () => {
    // Arrange
    const overrides = await globalIgnoreOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
  })

  it('When the run also reports a changes manifest, Then the rename target relocates to the delete bucket instead of surviving as a rename', async () => {
    // Arrange
    const overrides = await globalIgnoreOverrides()

    // Act
    const { payload } = await runBothModes(overrides)

    // Assert
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Add]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['ApexClass']).toEqual(['Foo'])
  })
})

describe('Given an ApexClass rename both ignore files cover', () => {
  it('When the run runs in both modes, Then neither manifest carries the type and the two runs stay byte-identical', async () => {
    // Arrange
    const overrides: Partial<ConfigInput> = {
      ignoreDestructive: await writePatterns(
        '.sgdignore-destructive-foo',
        `${RENAME_IGNORE_FOO_CLASS}\n${RENAME_IGNORE_FOO_META}\n`
      ),
      ignore: await writePatterns(
        '.sgdignore-global-bar',
        `${RENAME_IGNORE_BAR_CLASS}\n${RENAME_IGNORE_BAR_META}\n`
      ),
    }

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    for (const result of [off, on]) {
      expect(result.work.changes.forPackageManifest().has('ApexClass')).toBe(
        false
      )
      expect(
        result.work.changes.forDestructiveManifest().has('ApexClass')
      ).toBe(false)
    }
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
  })
})

describe('Given a class moved into a globally ignored directory and renamed on the way', () => {
  const archiveOverrides = async (): Promise<Partial<ConfigInput>> => ({
    to: refs.archiveMove,
    ignore: await writePatterns(
      '.sgdignore-archive',
      `${RENAME_IGNORE_ARCHIVE_ROOT}/\n`
    ),
  })

  it('When the run runs in both modes, Then the package member is gone and the source deletion survives', async () => {
    // Arrange
    const overrides = await archiveOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert — the destructive member is the positive control: a move into
    // an ignored directory must still produce no deployable artifact.
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual([])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual(['Baz'])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it', async () => {
    // Arrange
    const overrides = await archiveOverrides()

    // Act
    const { off, on } = await runBothModes(overrides)

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
  })

  it('When the run also reports a changes manifest, Then the rename never resurrects the ignored target and the source stays a plain deletion', async () => {
    // Arrange
    const overrides = await archiveOverrides()

    // Act
    const { payload } = await runBothModes(overrides)

    // Assert
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['ApexClass']).toEqual(['Baz'])
  })
})
