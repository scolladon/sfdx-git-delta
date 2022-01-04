'use strict'
const app = require('../src/main')
const os = require('os')
const { EventEmitter, Readable } = require('stream')
const child_process = require('child_process')
jest.mock('child_process', () => ({
  spawnSync: () => ({
    stdout: '1stsha',
  }),
  spawn: jest.fn(),
}))
jest.mock('fs-extra')
jest.mock('fs')

const fsMocked = require('fs')
const fseMocked = require('fs-extra')

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
    require('fs').__setMockFiles({
      output: '',
      '.': '',
    })
  })
  test('can execute with rich parameters and big diff', async () => {
    child_process.spawn.mockImplementation(() => {
      const mock = new EventEmitter()
      mock.stdout = new Readable({
        read() {
          this.push(lines.join(os.EOL))
          this.push(null)
          mock.emit('close')
        },
      })
      return mock
    })
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
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    child_process.spawn.mockImplementation(() => {
      const mock = new EventEmitter()
      mock.stdout = new Readable({
        read() {
          this.push(lines.join(os.EOL))
          this.push(null)
          mock.emit('close')
        },
      })
      return mock
    })
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'test',
      apiVersion: '46',
      generateDelta: true,
    })
    expect(work.warnings).not.toHaveLength(0)
  })

  test('do not generate destructiveChanges.xml and package.xml with same element', async () => {
    child_process.spawn.mockImplementation(() => {
      const mock = new EventEmitter()
      mock.stdout = new Readable({
        read() {
          this.push(lines.join(os.EOL))
          this.push(null)
          mock.emit('close')
        },
      })
      return mock
    })
    const work = await app({
      output: 'output',
      repo: '',
      source: '',
      to: 'test',
      apiVersion: '46',
      generateDelta: true,
    })

    expect(work.diffs.package.fields).toContain('Account.changed')
    expect(work.diffs.destructiveChanges.fields).not.toContain(
      'Account.changed'
    )
  })
})
