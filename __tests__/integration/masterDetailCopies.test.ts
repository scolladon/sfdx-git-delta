'use strict'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import { MASTER_DETAIL_TAG } from '../../src/constant/metadataConstants'
import sgd from '../../src/main'
import {
  FIXTURE_HOOK_BUDGET_MS,
  initRepo,
  makeCommit,
} from '../__utils__/gitFixtureRepo'
import { createTempDir, runGit } from '../__utils__/gitTestHarness'

// Pinning apiVersion keeps ConfigValidator away from the appexchange lookup —
// this bucket runs behind an unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60
const OBJECTS_DIR = 'force-app/objects'
const NS = 'http://soap.sforce.com/2006/04/metadata'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

const objectPath = (object: string): string =>
  `${OBJECTS_DIR}/${object}/${object}.object-meta.xml`
const fieldPath = (object: string, field: string): string =>
  `${OBJECTS_DIR}/${object}/fields/${field}.field-meta.xml`

const objectXml = (label = 'Object'): string =>
  `${XML_HEADER}
<CustomObject xmlns="${NS}">
    <label>${label}</label>
</CustomObject>
`

const fieldXml = (name: string, type: string): string =>
  `${XML_HEADER}
<CustomField xmlns="${NS}">
    <fullName>${name}</fullName>
    <type>${type}</type>
</CustomField>
`

const masterDetailXml = (name: string): string =>
  fieldXml(name, 'MasterDetail').replace(
    '<type>MasterDetail</type>',
    MASTER_DETAIL_TAG
  )

const addFile = (path: string, content: string) =>
  ({ kind: 'add', mode: '100644', path, content }) as const

let fixtureDir: string
let base: string
let objectAdded: string
let masterDetailFieldAdded: string
let textFieldAdded: string
let objectModified: string
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const commitOnBase = (name: string, ops: ReturnType<typeof addFile>[]) => {
  runGit(['read-tree', base], { cwd: fixtureDir })
  return makeCommit(fixtureDir, base, name, ops)
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-master-detail-copies-')
  initRepo(fixtureDir)
  base = makeCommit(fixtureDir, null, 'base objects', [
    addFile(objectPath('Acc'), objectXml()),
    addFile(fieldPath('Acc', 'Parent__c'), masterDetailXml('Parent__c')),
    addFile(fieldPath('Acc', 'Note__c'), fieldXml('Note__c', 'Text')),
    addFile(objectPath('Acc2'), objectXml()),
    addFile(fieldPath('Acc2', 'Parent__c'), masterDetailXml('Parent__c')),
  ])
  objectAdded = commitOnBase('add an object', [
    addFile(objectPath('Ord'), objectXml()),
    addFile(fieldPath('Ord', 'Acc__c'), masterDetailXml('Acc__c')),
    addFile(fieldPath('Ord', 'Memo__c'), fieldXml('Memo__c', 'Text')),
  ])
  masterDetailFieldAdded = commitOnBase('add a master detail', [
    addFile(fieldPath('Acc', 'Owner__c'), masterDetailXml('Owner__c')),
  ])
  textFieldAdded = commitOnBase('add a text field', [
    addFile(fieldPath('Acc', 'Extra__c'), fieldXml('Extra__c', 'Text')),
  ])
  objectModified = commitOnBase('modify an object', [
    addFile(objectPath('Acc'), objectXml('Account')),
  ])
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

const outputFiles = async (output: string): Promise<string[]> =>
  (await readdir(output, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry =>
      join(entry.parentPath, entry.name)
        .slice(output.length + 1)
        .split('\\')
        .join('/')
    )
    .sort()

const generate = async (to: string): Promise<string[]> => {
  const output = await trackedTempDir('sgd-master-detail-copies-out-')
  await sgd({
    from: base,
    to,
    mergeBase: false,
    output,
    source: ['force-app'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta: true,
    apiVersion: API_VERSION,
  })
  return outputFiles(output)
}

describe('Given master detail fields under prefix-sharing objects', () => {
  it('When an object with a master detail field is added, Then its fields and the parent object are copied', async () => {
    // Act
    const result = await generate(objectAdded)

    // Assert
    expect(result).toEqual([
      'destructiveChanges/destructiveChanges.xml',
      'destructiveChanges/package.xml',
      'force-app/objects/Ord/Ord.object-meta.xml',
      'force-app/objects/Ord/fields/Acc__c.field-meta.xml',
      'force-app/objects/Ord/fields/Memo__c.field-meta.xml',
      'package/package.xml',
    ])
  })

  it('When a master detail field is added, Then the field and its parent object are copied but not the sibling object', async () => {
    // Act
    const result = await generate(masterDetailFieldAdded)

    // Assert
    expect(result).toEqual([
      'destructiveChanges/destructiveChanges.xml',
      'destructiveChanges/package.xml',
      'force-app/objects/Acc/Acc.object-meta.xml',
      'force-app/objects/Acc/fields/Owner__c.field-meta.xml',
      'package/package.xml',
    ])
  })

  it('When a text field is added, Then only the field is copied', async () => {
    // Act
    const result = await generate(textFieldAdded)

    // Assert
    expect(result).toEqual([
      'destructiveChanges/destructiveChanges.xml',
      'destructiveChanges/package.xml',
      'force-app/objects/Acc/fields/Extra__c.field-meta.xml',
      'package/package.xml',
    ])
  })

  it('When an object is modified without field changes, Then only its master detail fields are copied, not those of the prefix-sharing sibling', async () => {
    // Act
    const result = await generate(objectModified)

    // Assert
    expect(result).toEqual([
      'destructiveChanges/destructiveChanges.xml',
      'destructiveChanges/package.xml',
      'force-app/objects/Acc/Acc.object-meta.xml',
      'force-app/objects/Acc/fields/Parent__c.field-meta.xml',
      'package/package.xml',
    ])
  })
})
