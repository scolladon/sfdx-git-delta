'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { ChangeKind } from '../../src/types/handlerResult'
import type { Manifest } from '../../src/types/work'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  readManifestXml,
  runBothModes as runBothModesWithHelpers,
} from '../__utils__/changesManifestHelpers'
import {
  buildRenameUnprocessableFixtureRepo,
  FIXTURE_HOOK_BUDGET_MS,
  type RenameUnprocessableFixtureRefs,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// makeInput pins apiVersion, so ConfigValidator's appexchange lookup is never
// reached for any run built through it — this bucket runs behind an
// unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60

let fixtureDir: string
let refs: RenameUnprocessableFixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const makeInput = async (
  overrides: Partial<ConfigInput> = {}
): Promise<ConfigInput> => ({
  to: refs.root,
  from: refs.root,
  mergeBase: false,
  output: await trackedTempDir('sgd-rename-unprocessable-out-'),
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
  const { packageXml, destructiveXml } = await readManifestXml(input.output)
  return { work, packageXml, destructiveXml }
}

const members = (manifest: Manifest, type: string): string[] =>
  [...(manifest.get(type) ?? [])].sort()

const runBothModes = (to: string): ReturnType<typeof runBothModesWithHelpers> =>
  runBothModesWithHelpers(
    runSgd,
    trackedTempDir,
    'sgd-rename-unprocessable-manifest-',
    { to }
  )

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-rename-unprocessable-fixture-')
  refs = buildRenameUnprocessableFixtureRepo(fixtureDir)
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

describe('Given a text file renamed inside the classes folder', () => {
  it('When the run runs in both modes, Then ApexClass package is [] and destructive is []', async () => {
    // Arrange
    const to = refs.txtRenamed

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual([])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual([])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and no ApexClass is reported as added, deleted or renamed', async () => {
    // Arrange
    const to = refs.txtRenamed

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Add]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['ApexClass']).toBeUndefined()
  })
})

describe('Given a text file renamed into an Apex class', () => {
  it('When the run runs in both modes, Then ApexClass package is [Foo] and destructive is []', async () => {
    // Arrange
    const to = refs.txtToClass

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual(['Foo'])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual([])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and Foo is only reported as added', async () => {
    // Arrange
    const to = refs.txtToClass

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Add]['ApexClass']).toEqual(['Foo'])
    expect(payload[ChangeKind.Delete]['ApexClass']).toBeUndefined()
  })
})

describe('Given an Apex class renamed into a text file', () => {
  it('When the run runs in both modes, Then ApexClass package is [] and destructive is [Bar]', async () => {
    // Arrange
    const to = refs.classToTxt

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual([])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual(['Bar'])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and Bar is only reported as deleted', async () => {
    // Arrange
    const to = refs.classToTxt

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Add]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['ApexClass']).toEqual(['Bar'])
  })
})

describe('Given a text file renamed inside the labels folder', () => {
  it('When the run runs in both modes, Then CustomLabel package is [] and destructive is []', async () => {
    // Arrange
    const to = refs.labelsTxtRenamed

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'CustomLabel')
      ).toEqual([])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'CustomLabel')
      ).toEqual([])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and no CustomLabel is reported as added, deleted or renamed', async () => {
    // Arrange
    const to = refs.labelsTxtRenamed

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['CustomLabel']).toBeUndefined()
    expect(payload[ChangeKind.Add]['CustomLabel']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['CustomLabel']).toBeUndefined()
  })
})

describe('Given the CustomLabels file renamed', () => {
  it('When the run runs in both modes, Then CustomLabel package is [L1] and destructive is []', async () => {
    // Arrange
    const to = refs.labelsFileRenamed

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'CustomLabel')
      ).toEqual(['L1'])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'CustomLabel')
      ).toEqual([])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and L1 is only reported as added', async () => {
    // Arrange
    const to = refs.labelsFileRenamed

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['CustomLabel']).toBeUndefined()
    expect(payload[ChangeKind.Add]['CustomLabel']).toEqual(['L1'])
    expect(payload[ChangeKind.Delete]['CustomLabel']).toBeUndefined()
  })
})

describe('Given an Apex class renamed by case only', () => {
  it('When the run runs in both modes, Then ApexClass package is [a] and destructive is []', async () => {
    // Arrange
    const to = refs.classCaseRenamed

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'ApexClass')
      ).toEqual(['a'])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'ApexClass')
      ).toEqual([])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and a is only reported as added', async () => {
    // Arrange
    const to = refs.classCaseRenamed

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['ApexClass']).toBeUndefined()
    expect(payload[ChangeKind.Add]['ApexClass']).toEqual(['a'])
    expect(payload[ChangeKind.Delete]['ApexClass']).toBeUndefined()
  })
})

describe('Given a workflow container renamed', () => {
  it('When the run runs in both modes, Then Workflow package is [Contact] and destructive is []', async () => {
    // Arrange
    const to = refs.workflowRenamed

    // Act
    const { off, on } = await runBothModes(to)

    // Assert
    for (const result of [off, on]) {
      expect(
        members(result.work.changes.forPackageManifest(), 'Workflow')
      ).toEqual(['Contact'])
      expect(
        members(result.work.changes.forDestructiveManifest(), 'Workflow')
      ).toEqual([])
    }
  })

  it('When the run also reports a changes manifest, Then both xml manifests are byte-identical to the run without it and the container is only reported as added', async () => {
    // Arrange
    const to = refs.workflowRenamed

    // Act
    const { off, on, payload } = await runBothModes(to)

    // Assert
    expect(on.packageXml).toBe(off.packageXml)
    expect(on.destructiveXml).toBe(off.destructiveXml)
    expect(payload[ChangeKind.Rename]['Workflow']).toBeUndefined()
    expect(payload[ChangeKind.Add]['Workflow']).toEqual(['Contact'])
    expect(payload[ChangeKind.Delete]['Workflow']).toBeUndefined()
  })
})
