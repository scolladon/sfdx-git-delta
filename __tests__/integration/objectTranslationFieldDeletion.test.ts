'use strict'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import { readManifestXml } from '../__utils__/changesManifestHelpers'
import {
  FIXTURE_HOOK_BUDGET_MS,
  initRepo,
  makeCommit,
} from '../__utils__/gitFixtureRepo'
import { createTempDir, runGit } from '../__utils__/gitTestHarness'

// Pinning apiVersion keeps ConfigValidator away from the appexchange lookup —
// this bucket runs behind an unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60
const COT = 'CustomObjectTranslation'
const ROOT = 'force-app/main/default'
const SUB_FOLDER = 'Account-de'
const TRANSLATIONS_DIR = `${ROOT}/objectTranslations`
const PARENT_PATH = `${TRANSLATIONS_DIR}/${SUB_FOLDER}/${SUB_FOLDER}.objectTranslation-meta.xml`
const FOO_TRANSLATION_PATH = `${TRANSLATIONS_DIR}/${SUB_FOLDER}/Foo__c.fieldTranslation-meta.xml`
const BAR_TRANSLATION_PATH = `${TRANSLATIONS_DIR}/${SUB_FOLDER}/Bar__c.fieldTranslation-meta.xml`
const FOO_FIELD_PATH = `${ROOT}/objects/Account/fields/Foo__c.field-meta.xml`
const FLAT_CONTACT_PATH = `${TRANSLATIONS_DIR}/Contact-de.objectTranslation-meta.xml`
const FLAT_LEAD_PATH = `${TRANSLATIONS_DIR}/Lead-de.objectTranslation-meta.xml`
const NS = 'http://soap.sforce.com/2006/04/metadata'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

const parentXml = (): string =>
  `${XML_HEADER}
<CustomObjectTranslation xmlns="${NS}">
    <nameFieldLabel>Name</nameFieldLabel>
</CustomObjectTranslation>
`

const fieldTranslationXml = (name: string): string =>
  `${XML_HEADER}
<CustomFieldTranslation xmlns="${NS}">
    <label>${name}</label>
    <name>${name}</name>
</CustomFieldTranslation>
`

const fieldXml = (): string =>
  `${XML_HEADER}
<CustomField xmlns="${NS}">
    <fullName>Foo__c</fullName>
    <label>Foo</label>
    <type>Text</type>
    <length>10</length>
</CustomField>
`

const addFile = (path: string, content: string) =>
  ({ kind: 'add', mode: '100644', path, content }) as const

const deleteFile = (path: string) => ({ kind: 'delete', path }) as const

const deleteAll = (...paths: string[]) => paths.map(deleteFile)

let fixtureDir: string
let base: string
let caseA: string
let caseF: string
let caseB: string
let caseC: string
let caseD: string
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const commitOnBase = (name: string, ops: ReturnType<typeof deleteFile>[]) => {
  runGit(['read-tree', base], { cwd: fixtureDir })
  return makeCommit(fixtureDir, base, name, ops)
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-object-translation-deletion-')
  initRepo(fixtureDir)
  base = makeCommit(fixtureDir, null, 'object translations', [
    addFile(PARENT_PATH, parentXml()),
    addFile(FOO_TRANSLATION_PATH, fieldTranslationXml('Foo__c')),
    addFile(BAR_TRANSLATION_PATH, fieldTranslationXml('Bar__c')),
    addFile(FOO_FIELD_PATH, fieldXml()),
    addFile(FLAT_CONTACT_PATH, parentXml()),
    addFile(FLAT_LEAD_PATH, parentXml()),
  ])
  caseA = commitOnBase(
    'delete a field translation and its field',
    deleteAll(FOO_TRANSLATION_PATH, FOO_FIELD_PATH)
  )
  caseF = commitOnBase(
    'delete every field translation',
    deleteAll(FOO_TRANSLATION_PATH, BAR_TRANSLATION_PATH)
  )
  caseB = commitOnBase(
    'delete the whole sub-folder',
    deleteAll(PARENT_PATH, FOO_TRANSLATION_PATH, BAR_TRANSLATION_PATH)
  )
  caseC = commitOnBase(
    'delete a flat translation',
    deleteAll(FLAT_CONTACT_PATH)
  )
  caseD = commitOnBase('delete the parent file only', deleteAll(PARENT_PATH))
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

const runSgd = (to: string, output: string, generateDelta = true) =>
  sgd({
    from: base,
    to,
    mergeBase: false,
    output,
    source: ['force-app'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta,
    apiVersion: API_VERSION,
  })

const members = (
  manifest: ReadonlyMap<string, ReadonlySet<string>>,
  type: string
): string[] => [...(manifest.get(type) ?? [])].sort()

const outputHas = (output: string, path: string): boolean =>
  existsSync(join(output, path))

describe('Given a sub-folder object translation whose field translation and field are deleted', () => {
  it('When generating the delta, Then the translation is packaged, the field is destructive and the parent file is copied', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-a-')

    // Act
    const sut = await runSgd(caseA, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([SUB_FOLDER])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([])
    expect(
      members(sut.changes.forDestructiveManifest(), 'CustomField')
    ).toEqual(['Account.Foo__c'])
    expect(outputHas(output, PARENT_PATH)).toBe(true)
    expect(outputHas(output, FOO_TRANSLATION_PATH)).toBe(false)
    expect(sut.warnings).toEqual([])
  })

  it('When generating case A without generateDelta, Then package.xml and destructiveChanges.xml equal the generateDelta run', async () => {
    // Arrange
    const withDelta = await trackedTempDir('sgd-object-translation-a-delta-')
    const withoutDelta = await trackedTempDir('sgd-object-translation-a-plain-')
    await runSgd(caseA, withDelta)
    await GitAdapter.closeAll()

    // Act
    await runSgd(caseA, withoutDelta, false)

    // Assert
    expect(await readManifestXml(withoutDelta)).toEqual(
      await readManifestXml(withDelta)
    )
  })
})

describe('Given a sub-folder object translation whose field translations are all deleted', () => {
  it('When generating the delta, Then the translation is packaged and the parent file is copied', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-f-')

    // Act
    const sut = await runSgd(caseF, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([SUB_FOLDER])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([])
    expect(outputHas(output, PARENT_PATH)).toBe(true)
    expect(sut.warnings).toEqual([])
  })
})

describe('Given a sub-folder object translation whose files are all deleted', () => {
  it('When generating the delta, Then the translation is destructive', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-b-')

    // Act
    const sut = await runSgd(caseB, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([
      SUB_FOLDER,
    ])
    expect(sut.warnings).toEqual([])
  })
})

describe('Given a flat object translation that is deleted', () => {
  it('When generating the delta, Then the translation is destructive', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-c-')

    // Act
    const sut = await runSgd(caseC, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([
      'Contact-de',
    ])
    expect(sut.warnings).toEqual([])
  })
})

describe('Given a sub-folder object translation whose parent file only is deleted', () => {
  it('When generating the delta, Then the translation is packaged without the deleted parent file', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-d-')

    // Act
    const sut = await runSgd(caseD, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([SUB_FOLDER])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([])
    expect(outputHas(output, PARENT_PATH)).toBe(false)
    expect(sut.warnings).toEqual([])
  })
})
