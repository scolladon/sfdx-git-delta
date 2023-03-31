'use strict'
const fs = require('fs')
const child_process = require('child_process')
const app = require('../../src/main')
const { COMMIT_REF_TYPE, GIT_FOLDER } = require('../../src/utils/gitConstants')
const { scanExtension } = require('../../src/utils/fsHelper')
jest.mock('fs')
jest.mock('fs-extra')
jest.mock('child_process')
jest.mock('../../src/utils/fsHelper')
scanExtension.mockImplementation(() => ({
  [Symbol.asyncIterator]: () => ({
    next: () => ({
      value: '',
      done: () => true,
    }),
  }),
}))

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
  'A      force-app/main/default/territory2Models/EU/territories/France.territory2-meta.xml',
  'A      force-app/main/default/territory2Models/EU/rules/France.territory2Rule-meta.xml',
]

describe(`test if the appli`, () => {
  beforeEach(() => {
    fs.__setMockFiles({
      output: '',
      [GIT_FOLDER]: '',
      '.': '',
    })
  })
  test('can execute with rich parameters and big diff', async () => {
    child_process.__setOutput([
      lines,
      [],
      [],
      [],
      [COMMIT_REF_TYPE],
      [COMMIT_REF_TYPE],
    ])
    expect(
      await app({
        output: 'output',
        repo: './',
        source: '',
        to: 'test',
        from: 'main',
        apiVersion: '46',
      })
    ).toHaveProperty('warnings', [])
  })

  test('catch internal warnings', async () => {
    child_process.__setOutput([
      lines,
      [],
      [],
      [],
      [COMMIT_REF_TYPE],
      [COMMIT_REF_TYPE],
    ])
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'HEAD',
      from: 'main',
      apiVersion: '46',
      generateDelta: true,
    })
    expect(work.warnings).not.toHaveLength(0)
  })

  test('do not generate destructiveChanges.xml and package.xml with same element', async () => {
    child_process.__setOutput([
      lines,
      [],
      [],
      [],
      [COMMIT_REF_TYPE],
      [COMMIT_REF_TYPE],
    ])
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'HEAD',
      from: 'main',
      apiVersion: '46',
      generateDelta: true,
    })

    expect(work.diffs.package.get('fields')).toContain('Account.changed')
    expect(work.diffs.destructiveChanges.get('fields')).not.toContain(
      'Account.changed'
    )
  })

  test('check for proper territory handling', async () => {
    child_process.__setOutput([
      lines,
      [],
      [],
      [],
      [COMMIT_REF_TYPE],
      [COMMIT_REF_TYPE],
    ])
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'HEAD',
      from: 'main',
      apiVersion: '46',
      generateDelta: true,
    })
    expect(work.diffs.package.get('rules')).toContain('EU.France')
  })
})
