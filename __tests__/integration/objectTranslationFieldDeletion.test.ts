'use strict'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import MetadataDiff from '../../src/utils/metadataDiff/index'
import { readManifestXml } from '../__utils__/changesManifestHelpers'
import {
  FIXTURE_HOOK_BUDGET_MS,
  type FixtureOp,
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
const BAZ_TRANSLATION_PATH = `${TRANSLATIONS_DIR}/${SUB_FOLDER}/Baz__c.fieldTranslation-meta.xml`
const FOO_FIELD_PATH = `${ROOT}/objects/Account/fields/Foo__c.field-meta.xml`
const FLAT_CONTACT_PATH = `${TRANSLATIONS_DIR}/Contact-de.objectTranslation-meta.xml`
const FLAT_LEAD_PATH = `${TRANSLATIONS_DIR}/Lead-de.objectTranslation-meta.xml`
const NS = 'http://soap.sforce.com/2006/04/metadata'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

const PINNED_PARENT_BYTES = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata">
    <fields>
        <label>Foo</label>
        <name>Foo__c</name>
    </fields>
    <nameFieldLabel>Name</nameFieldLabel>
</CustomObjectTranslation>
`

const parentXml = (): string =>
  `${XML_HEADER}
<CustomObjectTranslation xmlns="${NS}">
    <nameFieldLabel>Name</nameFieldLabel>
</CustomObjectTranslation>
`

// The untouched Bar__c entry is what pruning drops, so the copied parent
// differs from the raw head blob only when the diff's writer runs.
const parentWithUntouchedFieldXml = (): string =>
  `${XML_HEADER}
<CustomObjectTranslation xmlns="${NS}">
    <fields>
        <label>Bar</label>
        <name>Bar__c</name>
    </fields>
    <nameFieldLabel>Name</nameFieldLabel>
</CustomObjectTranslation>
`

const modifiedParentXml = (): string =>
  `${XML_HEADER}
<CustomObjectTranslation xmlns="${NS}">
    <fields>
        <label>Bar</label>
        <name>Bar__c</name>
    </fields>
    <fields>
        <label>Foo</label>
        <name>Foo__c</name>
    </fields>
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
let fieldAndTranslationDeleted: string
let allFieldTranslationsDeleted: string
let componentFolderDeleted: string
let flatFileDeleted: string
let parentFileDeleted: string
let childrenAndParentModified: string
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const commitOnBase = (name: string, ops: FixtureOp[]) => {
  runGit(['read-tree', base], { cwd: fixtureDir })
  return makeCommit(fixtureDir, base, name, ops)
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-object-translation-deletion-')
  initRepo(fixtureDir)
  base = makeCommit(fixtureDir, null, 'object translations', [
    addFile(PARENT_PATH, parentWithUntouchedFieldXml()),
    addFile(FOO_TRANSLATION_PATH, fieldTranslationXml('Foo__c')),
    addFile(BAR_TRANSLATION_PATH, fieldTranslationXml('Bar__c')),
    addFile(FOO_FIELD_PATH, fieldXml()),
    addFile(FLAT_CONTACT_PATH, parentXml()),
    addFile(FLAT_LEAD_PATH, parentXml()),
  ])
  fieldAndTranslationDeleted = commitOnBase(
    'delete a field translation and its field',
    deleteAll(FOO_TRANSLATION_PATH, FOO_FIELD_PATH)
  )
  allFieldTranslationsDeleted = commitOnBase(
    'delete every field translation',
    deleteAll(FOO_TRANSLATION_PATH, BAR_TRANSLATION_PATH)
  )
  componentFolderDeleted = commitOnBase(
    'delete the whole sub-folder',
    deleteAll(PARENT_PATH, FOO_TRANSLATION_PATH, BAR_TRANSLATION_PATH)
  )
  flatFileDeleted = commitOnBase(
    'delete a flat translation',
    deleteAll(FLAT_CONTACT_PATH)
  )
  parentFileDeleted = commitOnBase(
    'delete the parent file only',
    deleteAll(PARENT_PATH)
  )
  childrenAndParentModified = commitOnBase(
    'modify the parent and three field translations',
    [
      addFile(PARENT_PATH, modifiedParentXml()),
      addFile(FOO_TRANSLATION_PATH, fieldTranslationXml('Foo changed')),
      addFile(BAR_TRANSLATION_PATH, fieldTranslationXml('Bar changed')),
      addFile(BAZ_TRANSLATION_PATH, fieldTranslationXml('Baz__c')),
    ]
  )
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  vi.restoreAllMocks()
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

const runSgd = (
  to: string,
  output: string,
  overrides: Partial<ConfigInput> = {}
) =>
  sgd({
    from: base,
    to,
    mergeBase: false,
    output,
    source: ['force-app'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta: true,
    apiVersion: API_VERSION,
    ...overrides,
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
    const output = await trackedTempDir('sgd-object-translation-field-deleted-')

    // Act
    const sut = await runSgd(fieldAndTranslationDeleted, output)

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

  it('When generating the delta without generateDelta, Then package.xml and destructiveChanges.xml equal the generateDelta run', async () => {
    // Arrange
    const withDelta = await trackedTempDir(
      'sgd-object-translation-field-deleted-with-delta-'
    )
    const withoutDelta = await trackedTempDir(
      'sgd-object-translation-field-deleted-without-delta-'
    )
    await runSgd(fieldAndTranslationDeleted, withDelta)
    await GitAdapter.closeAll()

    // Act
    await runSgd(fieldAndTranslationDeleted, withoutDelta, {
      generateDelta: false,
    })

    // Assert
    expect(await readManifestXml(withoutDelta)).toEqual(
      await readManifestXml(withDelta)
    )
  })
})

describe('Given a sub-folder object translation whose field translations are all deleted', () => {
  it('When generating the delta, Then the translation is packaged and the parent file is copied', async () => {
    // Arrange
    const output = await trackedTempDir(
      'sgd-object-translation-all-fields-deleted-'
    )

    // Act
    const sut = await runSgd(allFieldTranslationsDeleted, output)

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
    const output = await trackedTempDir(
      'sgd-object-translation-folder-deleted-'
    )

    // Act
    const sut = await runSgd(componentFolderDeleted, output)

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
    const output = await trackedTempDir('sgd-object-translation-flat-deleted-')

    // Act
    const sut = await runSgd(flatFileDeleted, output)

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
    const output = await trackedTempDir(
      'sgd-object-translation-parent-deleted-'
    )

    // Act
    const sut = await runSgd(parentFileDeleted, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([SUB_FOLDER])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([])
    expect(outputHas(output, PARENT_PATH)).toBe(false)
    expect(sut.warnings).toEqual([])
  })
})

const parentDiffCalls = (spy: { mock: { calls: unknown[][] } }): number =>
  spy.mock.calls.filter(([path]) => path === PARENT_PATH).length

describe('Given a modified parent objectTranslation and three changed field translations', () => {
  it('When generating the delta, Then the parent is diffed once', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-memo-')
    const spy = vi.spyOn(MetadataDiff.prototype, 'run')

    // Act
    await runSgd(childrenAndParentModified, output)

    // Assert
    expect(parentDiffCalls(spy)).toBe(1)
  })

  it('When generating the delta, Then the copied parent carries the pinned pruned content', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-bytes-')

    // Act
    await runSgd(childrenAndParentModified, output)

    // Assert
    expect(await readFile(join(output, PARENT_PATH), 'utf8')).toBe(
      PINNED_PARENT_BYTES
    )
  })

  it('When generating the delta, Then only the translation is packaged and nothing is destroyed', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-manifest-')

    // Act
    const sut = await runSgd(childrenAndParentModified, output)

    // Assert
    expect(members(sut.changes.forPackageManifest(), COT)).toEqual([SUB_FOLDER])
    expect(members(sut.changes.forDestructiveManifest(), COT)).toEqual([])
  })

  it('When generating the delta without generateDelta, Then package.xml and destructiveChanges.xml equal the generateDelta run', async () => {
    // Arrange
    const withDelta = await trackedTempDir('sgd-object-translation-memo-wd-')
    const withoutDelta = await trackedTempDir('sgd-object-translation-memo-nd-')
    await runSgd(childrenAndParentModified, withDelta)
    await GitAdapter.closeAll()

    // Act
    await runSgd(childrenAndParentModified, withoutDelta, {
      generateDelta: false,
    })

    // Assert
    expect(await readManifestXml(withoutDelta)).toEqual(
      await readManifestXml(withDelta)
    )
  })
})

describe('Given the modified parent is also covered by --include', () => {
  it('When generating the delta, Then the parent is diffed once per pass', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-object-translation-include-')
    const include = join(await trackedTempDir('sgd-ot-include-'), 'inc')
    await writeFile(include, `${PARENT_PATH}\n`)
    const spy = vi.spyOn(MetadataDiff.prototype, 'run')

    // Act
    await runSgd(childrenAndParentModified, output, { include })

    // Assert
    expect(parentDiffCalls(spy)).toBe(2)
  })
})
