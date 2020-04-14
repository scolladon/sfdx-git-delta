'use strict'
const app = require('../../index')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')
jest.mock('git-state')
jest.mock('xml2js')

const fsMocked = require('fs')
const fseMocked = require('fs-extra')
const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

describe(`test if the appli`, () => {
  beforeAll(() => {
    fsMocked.errorMode = false
    fseMocked.errorMode = false
    fsMocked.__setMockFiles({
      output: '',
    })
  })

  test('can execute with simple parameters and no diff', async () => {
    mySpawn.setDefault(mySpawn.simple(0, ''))
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).resolves.toStrictEqual([])
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

  test('catch and reject big issues', async () => {
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).rejects.toBeTruthy()
  })

  test('catch internal qwaks', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'A      force-app/main/default/workflows/Account.workflow-meta.xml'
      )
    )
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).rejects.toBeTruthy()
  })

  test('throw errors when to parameter is not filled', async () => {
    await expect(
      app({ output: 'output', repo: '', apiVersion: '46' })
    ).rejects.toBeTruthy()
  })

  test('throw errors when apiVersion parameter is NaN', async () => {
    await expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: 'NotANumber' })
    ).rejects.toBeTruthy()
  })

  test('throw errors when output folder does not exist', async () => {
    await expect(
      app({
        output: 'not/exist/folder',
        repo: '',
        to: 'test',
        apiVersion: '46',
      })
    ).rejects.toBeTruthy()
  })

  test('throw errors when output is not a folder', async () => {
    await expect(
      app({ output: 'file', repo: '', to: 'test', apiVersion: '46' })
    ).rejects.toBeTruthy()
  })

  test('throw errors when repo is not git repository', async () => {
    await expect(
      app({
        output: 'output',
        repo: 'not/git/folder',
        to: 'test',
        apiVersion: '46',
      })
    ).rejects.toBeTruthy()
  })
})
