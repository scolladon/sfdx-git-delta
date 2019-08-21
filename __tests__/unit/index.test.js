'use strict'
const app = require('../../index')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

describe(`test if the appli`, () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      output: '',
    })
  })

  test('can execute with simple parameters and no diff', async () => {
    mySpawn.setDefault(mySpawn.simple(0, ''))
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).resolves.toStrictEqual([])
  })

  test('throw errors when parameters are not filled', async () => {
    mySpawn.setDefault(mySpawn.simple(0, ''))
    await expect(
      app({ output: 'output', repo: '', apiVersion: '46' })
    ).rejects.toBeTruthy()
  })

  test('can execute with simple parameters and an Addition', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).resolves.toStrictEqual([])
  })

  test('can execute with simple parameters and a Deletion', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).resolves.toStrictEqual([])
  })

  test('can execute with simple parameters and a Modification', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).resolves.toStrictEqual([])
  })
})
