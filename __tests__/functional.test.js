'use strict'
const app = require('../src/main')
jest.mock('fs')
jest.mock('fs-extra')
jest.mock('child_process')
const fs = require('fs')
const child_process = require('child_process')

const lines = [
  'D      force-app/main/default/objects/Account/fields/deleted.field-meta.xml',
  'A      force-app/main/default/objects/Account/fields/added.field-meta.xml',
  'M      force-app/main/default/objects/Account/fields/changed.field-meta.xml',
  'M      force-app/main/default/classes/Changed.cls',
  'A      force-app/main/default/classes/Added.cls',
  'A      force-app/main/default/classes/Added.cls-meta.xml',
  'D      force-app/main/default/classes/Deleted.cls',
  'M      force-app/main/default/classes/controllers/Changed.cls',
  'A      force-app/main/default/classes/controllers/Added.cls',
  'A      force-app/main/default/classes/controllers/Added.cls-meta.xml',
  'D      force-app/main/default/classes/controllers/Deleted.cls',
  'A      force-app/main/default/staticressources/Added.resource-meta.xml',
  'A      force-app/main/default/staticressources/Added.zip',
  'M      force-app/main/default/staticressources/Added/changed.png',
  'D      force-app/main/default/staticressources/Added/deleted.png',
  'A      force-app/main/default/documents/Added/doc.document',
  'A      force-app/main/default/lwc/Added/component.js`',
  'D      force-app/main/sample/objects/Account/fields/changed.field-meta.xml',
]

describe(`test if the appli`, () => {
  beforeEach(() => {
    fs.__setMockFiles({
      output: '',
      '.': '',
    })
  })
  test('can execute with rich parameters and big diff', async () => {
    child_process.__setOutput([lines, [], ['firstSHA']])
    expect(
      await app({
        output: 'output',
        repo: 'repo/path',
        source: '',
        to: 'test',
        apiVersion: '46',
      })
    ).toHaveProperty('warnings', [])
  })

  test('catch internal warnings', async () => {
    fs.errorMode = true
    child_process.__setOutput([lines, [], ['firstSHA']])
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'HEAD',
      apiVersion: '46',
      generateDelta: true,
    })
    expect(work.warnings).not.toHaveLength(0)
  })

  test('do not generate destructiveChanges.xml and package.xml with same element', async () => {
    child_process.__setOutput([lines, [], ['firstSHA']])
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'HEAD',
      apiVersion: '46',
      generateDelta: true,
    })

    expect(work.diffs.package.fields).toContain('Account.changed')
    expect(work.diffs.destructiveChanges.fields).not.toContain(
      'Account.changed'
    )
  })
})
