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
import { MessageService } from '../../src/utils/MessageService'
import type { ChangesManifestJson } from '../__utils__/changesManifestHelpers'
import {
  buildUndeletableTypeFixtureRepo,
  FIXTURE_HOOK_BUDGET_MS,
  UNDELETABLE_CONTACT_RECORD_TYPES_GLOB,
  type UndeletableTypeFixtureRefs,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// makeInput pins apiVersion, so ConfigValidator's appexchange lookup is never
// reached for any run built through it — this bucket runs behind an
// unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60

let fixtureDir: string
let refs: UndeletableTypeFixtureRefs
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
  const file = join(
    await trackedTempDir('sgd-undeletable-types-patterns-'),
    name
  )
  await writeFile(file, patterns)
  return file
}

const makeInput = async (
  overrides: Partial<ConfigInput> = {}
): Promise<ConfigInput> => ({
  to: refs.recordTypeDeleted,
  from: refs.root,
  mergeBase: false,
  output: await trackedTempDir('sgd-undeletable-types-out-'),
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

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-undeletable-types-fixture-')
  refs = buildUndeletableTypeFixtureRepo(fixtureDir)
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

describe('Given a record type deleted with no flags at all', () => {
  it('When the run produces both manifests, Then the destructive manifest carries no record type and the package manifest is untouched', async () => {
    // Act
    const { work, destructiveXml } = await runSgd({
      to: refs.recordTypeDeleted,
    })

    // Assert — characterisation: this observable does not change across the
    // seam move from IgnoreHelper's default pattern to the type-level strip.
    expect(work.changes.forDestructiveManifest().has('RecordType')).toBe(false)
    expect(destructiveXml).not.toContain('<name>RecordType</name>')
    expect(members(work.changes.forPackageManifest(), 'RecordType')).toEqual([])
  })

  it('When the run also reports a changes manifest, Then the deleted member surfaces in the delete bucket', async () => {
    // Arrange
    const changesManifest = join(
      await trackedTempDir('sgd-undeletable-deleted-manifest-'),
      'changes.manifest.json'
    )

    // Act
    const { work } = await runSgd({
      to: refs.recordTypeDeleted,
      changesManifest,
    })
    const payload = JSON.parse(
      await readFile(changesManifest, 'utf8')
    ) as ChangesManifestJson

    // Assert — the accepted default-configuration change README states: the
    // deletion is omitted from destructiveChanges.xml yet visible in the
    // review manifest, where it previously appeared nowhere at all.
    expect(work.changes.forDestructiveManifest().has('RecordType')).toBe(false)
    expect(payload[ChangeKind.Delete]['RecordType']).toEqual(['Account.Alpha'])
    expect(payload[ChangeKind.Rename]['RecordType']).toBeUndefined()
  })

  it('When the run produces both manifests, Then a warning names the record type and the orphaned member through the real catalogue', async () => {
    // Act
    const { work } = await runSgd({ to: refs.recordTypeDeleted })

    // Assert — exact-array equality proves this is the only warning: the
    // fixture's anchor exists precisely to guarantee nothing else fires.
    const expectedWarning = new MessageService().getMessage(
      'warning.UndeletableComponentsOmitted',
      ['RecordType', 'Account.Alpha']
    )
    expect(work.warnings.map(warning => warning.message)).toEqual([
      expectedWarning,
    ])
  })
})

describe('Given a record type deleted together with its holder object', () => {
  it('When the run produces both manifests, Then the holder is destroyed and no orphan warning fires', async () => {
    // Act
    const { work, destructiveXml } = await runSgd({ to: refs.holderDeleted })

    // Assert — the same deploy deletes the CustomObject, which takes its
    // record types with it, so telling the user to remove one by hand in
    // Setup would send them after something that will not be there.
    expect(
      members(work.changes.forDestructiveManifest(), 'CustomObject')
    ).toEqual(['Account'])
    expect(destructiveXml).not.toContain('<name>RecordType</name>')
    expect(work.warnings).toEqual([])
  })
})

describe('Given a record type renamed with no ignore file configured', () => {
  it('When the run also reports a changes manifest, Then the destructive manifest is empty and the whole JSON payload stays a pure bug fix', async () => {
    // Arrange
    const changesManifest = join(
      await trackedTempDir('sgd-undeletable-types-manifest-'),
      'changes.manifest.json'
    )

    // Act
    const { work, destructiveXml } = await runSgd({
      to: refs.recordTypeRenamed,
      changesManifest,
    })
    const payload = JSON.parse(
      await readFile(changesManifest, 'utf8')
    ) as ChangesManifestJson

    // Assert — the deploy-failing entry the org probe proved is gone.
    expect(work.changes.forDestructiveManifest().has('RecordType')).toBe(false)
    expect(destructiveXml).not.toContain('<name>RecordType</name>')
    expect(members(work.changes.forPackageManifest(), 'RecordType')).toEqual([
      'Account.Beta',
    ])
    // A whole-payload assertion is required: the delete bucket lands empty
    // by a different route after this change (the D line now flows and is
    // subtracted against the rename source, rather than being dropped
    // upstream), so only checking every bucket proves the rename half
    // stayed a pure bug fix when its internal route changed.
    expect(payload[ChangeKind.Add]['RecordType']).toBeUndefined()
    expect(payload[ChangeKind.Modify]['RecordType']).toBeUndefined()
    expect(payload[ChangeKind.Delete]['RecordType']).toBeUndefined()
    // A literal pair is safe here for one reason only, and it is not blob
    // uniqueness: this diff holds exactly one delete and one add, so the
    // pairing is forced whatever the detection algorithm does. The set-level
    // assertions below are the pairing-invariant ones.
    const renamed = payload[ChangeKind.Rename]['RecordType']!
    expect(renamed.map(pair => pair.from).sort()).toEqual(['Account.Alpha'])
    expect(renamed.map(pair => pair.to).sort()).toEqual(['Account.Beta'])
    expect(renamed).toEqual([{ from: 'Account.Alpha', to: 'Account.Beta' }])
  })

  it('When the run also reports a changes manifest, Then a warning names the orphaned rename source through the real catalogue', async () => {
    // Arrange
    const changesManifest = join(
      await trackedTempDir('sgd-undeletable-types-manifest-'),
      'changes.manifest.json'
    )

    // Act
    const { work } = await runSgd({
      to: refs.recordTypeRenamed,
      changesManifest,
    })

    // Assert — a renamed record type is orphaned exactly as a deleted one
    // is: the rename bucket still reports the move, this warning reports
    // its consequence.
    const expectedWarning = new MessageService().getMessage(
      'warning.UndeletableComponentsOmitted',
      ['RecordType', 'Account.Alpha']
    )
    expect(work.warnings.map(warning => warning.message)).toEqual([
      expectedWarning,
    ])
  })
})

describe('Given an include-destructive pattern covering a record type directory', () => {
  it('When the run has no rename and no changes manifest, Then the include walk never leaks the undeletable type into the destructive manifest', async () => {
    // Arrange — pre-existing bug: IncludeProcessor pushes synthetic D lines
    // straight into DiffLineInterpreter, bypassing RepoGitDiff._routeLine's
    // ignore gate entirely, so only a type-level strip closes it.
    const includeDestructive = await writePatterns(
      '.sgdinclude-destructive-contact-record-types',
      `${UNDELETABLE_CONTACT_RECORD_TYPES_GLOB}\n`
    )

    // Act
    const { work, destructiveXml } = await runSgd({
      to: refs.anchorTouched,
      includeDestructive,
    })

    // Assert
    expect(work.changes.forDestructiveManifest().has('RecordType')).toBe(false)
    expect(destructiveXml).not.toContain('<name>RecordType</name>')
    expect(destructiveXml).not.toContain('Contact.Delta')
    // Positive control proving the run really produced a manifest.
    expect(members(work.changes.forPackageManifest(), 'ApexClass')).toEqual([
      'Anchor',
    ])
  })

  it('When the run has no rename and no changes manifest, Then a warning names the member found through the include walk', async () => {
    // Arrange
    const includeDestructive = await writePatterns(
      '.sgdinclude-destructive-contact-record-types',
      `${UNDELETABLE_CONTACT_RECORD_TYPES_GLOB}\n`
    )

    // Act
    const { work } = await runSgd({
      to: refs.anchorTouched,
      includeDestructive,
    })

    // Assert — R8 covers all three routes, not just the two the rename
    // work touches.
    const expectedWarning = new MessageService().getMessage(
      'warning.UndeletableComponentsOmitted',
      ['RecordType', 'Contact.Delta']
    )
    expect(work.warnings.map(warning => warning.message)).toEqual([
      expectedWarning,
    ])
  })
})
