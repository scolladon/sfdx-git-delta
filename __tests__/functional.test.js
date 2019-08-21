'use strict'
const os = require('os')
const app = require('../index')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

const lines = [
  'D      force-app/main/default/objects/Account/fields/deleted.field-meta.xml',
  'A      force-app/main/default/objects/Account/fields/added.field-meta.xml',
  'M      force-app/main/default/objects/Account/fields/changed.field-meta.xml',
  'M      force-app/main/default/classes/Changed.cls',
  'A      force-app/main/default/classes/Added.cls',
  'A      force-app/main/default/classes/Added.cls-meta.xml',
  'A      force-app/main/default/staticressources/Added.resource-meta.xml',
  'A      force-app/main/default/staticressources/Added.zip',
  'M      force-app/main/default/staticressources/Added/changed.png',
  'D      force-app/main/default/staticressources/Added/deleted.png',
  'A      force-app/main/default/documents/Added/doc.document',
  'A      force-app/main/default/lwc/Added/component.js`',
]

describe(`test if the appli`, () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      output: '',
    })
  })
  test('can execute with rich parameters and big diff', async () => {
    mySpawn.setDefault(mySpawn.simple(0, lines.join(os.EOL)))
    await expect(
      app({
        output: 'output',
        repo: 'repo/path',
        to: 'test',
        apiVersion: '46',
      })
    ).resolves.toStrictEqual([])
  })
})
