'use strict'
import { existsSync, readdirSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { ChangeKind } from '../../src/types/handlerResult'
import type { Manifest } from '../../src/types/work'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import { runBothModes } from '../__utils__/changesManifestHelpers'
import {
  buildDecomposedSourceFormatsFixtureRepo,
  DECOMPOSED_REGISTRATIONS_DIR,
  type DecomposedSourceFormatsFixtureRefs,
  FIXTURE_HOOK_BUDGET_MS,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// Pinning apiVersion keeps ConfigValidator away from the appexchange lookup —
// this bucket runs behind an unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60
const ESR = 'ExternalServiceRegistration'

type Expected = Record<string, string[]>
type Row = {
  scenario: keyof DecomposedSourceFormatsFixtureRefs
  packaged: Expected
  destructive: Expected
  copies?: string[]
}

let fixtureDir: string
let refs: DecomposedSourceFormatsFixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const runSgd = async (
  scenario: keyof DecomposedSourceFormatsFixtureRefs,
  overrides: Partial<ConfigInput> = {}
) => {
  const output = await trackedTempDir('sgd-decomposed-out-')
  const work = await sgd({
    to: refs[scenario].to,
    from: refs[scenario].from,
    mergeBase: false,
    output,
    source: ['force-app'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta: false,
    apiVersion: API_VERSION,
    ...overrides,
  })
  return { work, output }
}

const runSgdWithXml = async (
  scenario: keyof DecomposedSourceFormatsFixtureRefs,
  overrides: Partial<ConfigInput>
) => {
  const { work, output } = await runSgd(scenario, overrides)
  const packageXml = await readFile(
    join(output, 'package', 'package.xml'),
    'utf8'
  )
  const destructiveXml = await readFile(
    join(output, 'destructiveChanges', 'destructiveChanges.xml'),
    'utf8'
  )
  return { work, packageXml, destructiveXml }
}

const runScenarioBothModes = (
  scenario: keyof DecomposedSourceFormatsFixtureRefs
) =>
  runBothModes(
    overrides => runSgdWithXml(scenario, overrides),
    trackedTempDir,
    'sgd-decomposed-changes-'
  )

const manifestOf = (manifest: Manifest): Record<string, string[]> =>
  Object.fromEntries(
    [...manifest.entries()].map(([type, members]) => [
      type,
      [...members].sort(),
    ])
  )

const copiedRegistrations = (output: string): string[] => {
  const dir = join(output, DECOMPOSED_REGISTRATIONS_DIR)
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

const definition = (name: string) =>
  `${name}.externalServiceRegistration-meta.xml`
const schema = (name: string) => `${name}.yaml`

const PRESET_ROWS: Row[] = [
  {
    scenario: 'workflowAlertModified',
    packaged: { WorkflowAlert: ['Account.MyAlert'] },
    destructive: {},
  },
  {
    scenario: 'workflowAlertDeleted',
    packaged: {},
    destructive: { WorkflowAlert: ['Account.MyAlert'] },
  },
  {
    scenario: 'sharingOwnerRuleModified',
    packaged: { SharingOwnerRule: ['Account.MyOwner'] },
    destructive: {},
  },
  {
    scenario: 'sharingOwnerRuleDeleted',
    packaged: {},
    destructive: { SharingOwnerRule: ['Account.MyOwner'] },
  },
  {
    scenario: 'labelBetaModified',
    packaged: { CustomLabel: ['LBeta'] },
    destructive: {},
  },
  {
    scenario: 'labelBetaDeleted',
    packaged: {},
    destructive: { CustomLabel: ['LBeta'] },
  },
  {
    scenario: 'labelBeta2Modified',
    packaged: { CustomLabel: ['LBeta2'] },
    destructive: {},
  },
  {
    scenario: 'labelBeta2Deleted',
    packaged: {},
    destructive: { CustomLabel: ['LBeta2'] },
  },
  {
    scenario: 'permissionSetBetaChildModified',
    packaged: { PermissionSet: ['PSBeta'] },
    destructive: {},
  },
  {
    scenario: 'permissionSetBetaChildDeleted',
    packaged: { PermissionSet: ['PSBeta'] },
    destructive: {},
  },
  {
    scenario: 'permissionSetBeta2ChildModified',
    packaged: { PermissionSet: ['PSBeta2'] },
    destructive: {},
  },
  {
    scenario: 'permissionSetBeta2ChildDeleted',
    packaged: { PermissionSet: ['PSBeta2'] },
    destructive: {},
  },
]

const REGISTRATION_ROWS: Required<Row>[] = [
  {
    scenario: 'registrationSchemaModified',
    packaged: { [ESR]: ['SvcLive'] },
    destructive: {},
    copies: [definition('SvcLive'), schema('SvcLive')],
  },
  {
    scenario: 'registrationDefinitionModified',
    packaged: { [ESR]: ['SvcLive'] },
    destructive: {},
    copies: [definition('SvcLive'), schema('SvcLive')],
  },
  {
    scenario: 'registrationSchemaRenamed',
    packaged: { [ESR]: ['SvcRen', 'SvcRen2'] },
    destructive: {},
    copies: [definition('SvcRen'), schema('SvcRen2')],
  },
  {
    scenario: 'registrationSchemaDeleted',
    packaged: { [ESR]: ['SvcLive'] },
    destructive: {},
    copies: [definition('SvcLive')],
  },
  {
    scenario: 'registrationRemoved',
    packaged: {},
    destructive: { [ESR]: ['SvcGone'] },
    copies: [],
  },
  {
    scenario: 'registrationLeavingPreset',
    packaged: { [ESR]: ['SvcLeave'] },
    destructive: {},
    copies: [definition('SvcLeave')],
  },
  {
    scenario: 'orphanSchemaDeleted',
    packaged: {},
    destructive: {},
    copies: [],
  },
  {
    scenario: 'monolithicRegistrationModified',
    packaged: { [ESR]: ['SvcMono'] },
    destructive: {},
    copies: [definition('SvcMono')],
  },
]

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-decomposed-fixture-')
  refs = buildDecomposedSourceFormatsFixtureRepo(fixtureDir)
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

describe.each(PRESET_ROWS)(
  'Given the $scenario diff',
  ({ scenario, packaged, destructive }) => {
    it('When sgd runs, Then the manifests hold exactly the expected members', async () => {
      // Act
      const { work } = await runSgd(scenario)

      // Assert
      expect(manifestOf(work.changes.forPackageManifest())).toEqual(packaged)
      expect(manifestOf(work.changes.forDestructiveManifest())).toEqual(
        destructive
      )
    })
  }
)

describe.each(REGISTRATION_ROWS)(
  'Given the $scenario diff',
  ({ scenario, packaged, destructive, copies }) => {
    it('When sgd runs without --generate-delta, Then the manifests hold exactly the expected members', async () => {
      // Act
      const { work } = await runSgd(scenario)

      // Assert
      expect(manifestOf(work.changes.forPackageManifest())).toEqual(packaged)
      expect(manifestOf(work.changes.forDestructiveManifest())).toEqual(
        destructive
      )
    })

    it('When sgd runs with --generate-delta, Then the manifests are unchanged and exactly the registration files present at --to are copied', async () => {
      // Act
      const { work, output } = await runSgd(scenario, { generateDelta: true })

      // Assert
      expect(manifestOf(work.changes.forPackageManifest())).toEqual(packaged)
      expect(manifestOf(work.changes.forDestructiveManifest())).toEqual(
        destructive
      )
      expect(copiedRegistrations(output)).toEqual([...copies].sort())
    })
  }
)

describe('Given the registrationSchemaRenamed diff', () => {
  it('When sgd runs with a changes manifest, Then the manifests are unchanged and the rename never reaches the delete bucket', async () => {
    // Act
    const { off, on, payload } = await runScenarioBothModes(
      'registrationSchemaRenamed'
    )

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
    expect(payload[ChangeKind.Delete][ESR]).toBeUndefined()
    const renamed = (payload[ChangeKind.Rename][ESR] ?? []).flatMap(
      ({ from, to }) => [from, to]
    )
    const listed = [
      ...renamed,
      ...(payload[ChangeKind.Add][ESR] ?? []),
      ...(payload[ChangeKind.Modify][ESR] ?? []),
    ]
    expect(new Set(listed)).toEqual(new Set(['SvcRen', 'SvcRen2']))
  })
})

describe('Given the registrationLeavingPreset diff', () => {
  it('When sgd runs with a changes manifest, Then the registration is listed as modified and never as deleted', async () => {
    // Act
    const { off, on, payload } = await runScenarioBothModes(
      'registrationLeavingPreset'
    )

    // Assert
    expect(on.packageXml).toEqual(off.packageXml)
    expect(on.destructiveXml).toEqual(off.destructiveXml)
    expect(payload[ChangeKind.Modify][ESR]).toEqual(['SvcLeave'])
    expect(payload[ChangeKind.Delete][ESR]).toBeUndefined()
  })
})
