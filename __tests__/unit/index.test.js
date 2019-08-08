'use strict'
const app = require('../../index')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

describe(`test if the appli`, () => {
  test('can execute with simple parameters and no diff', async () => {
    mySpawn.setDefault(mySpawn.simple(0, ''))
    await expect(
      app({ output: '', repo: '', to: 'test', apiVersion: '46.0' })
    ).resolves.toBeUndefined()
  })

  test('throw errors when parameters are not filled', async () => {
    mySpawn.setDefault(mySpawn.simple(0, ''))
    await expect(
      app({ output: '', repo: '', apiVersion: '46.0' })
    ).rejects.toStrictEqual(
      new Error(
        `Not enough parameter. Execute -h to better understand how to execute`
      )
    )
  })

  test('can execute with simple parameters and an Addition', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    await expect(
      app({ output: '', repo: '', to: 'test', apiVersion: '46.0' })
    ).resolves.toBeUndefined()
  })

  test('can execute with simple parameters and a Deletion', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    await expect(
      app({ output: '', repo: '', to: 'test', apiVersion: '46.0' })
    ).resolves.toBeUndefined()
  })

  test('can execute with simple parameters and a Modification', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    await expect(
      app({ output: '', repo: '', to: 'test', apiVersion: '46.0' })
    ).resolves.toBeUndefined()
  })
})
