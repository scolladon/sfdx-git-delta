'use strict'
const app = require('../../src/main')

jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')
const child_process = require('child_process')
const fsMocked = require('fs')
const fseMocked = require('fs-extra')

const testConfig = {
  output: 'output',
  repo: '',
  source: '',
  to: 'test',
  apiVersion: '46',
}

describe(`test if the appli`, () => {
  beforeAll(() => {
    fsMocked.errorMode = false
    fseMocked.errorMode = false
    fseMocked.outputFileError = false
    fsMocked.__setMockFiles({
      output: '',
      '.': '',
      '.forceignore': '',
      '.forceinclude': '',
    })
  })

  beforeEach(() => {
    child_process.__setOutput([])
    child_process.__setError(false)
  })

  test('can execute with simple parameters and no diff', async () => {
    expect(await app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and an Addition', async () => {
    expect(await app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and a Deletion', async () => {
    expect(await app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and a Modification', async () => {
    expect(await app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with complex parameters and a Modification', async () => {
    expect(
      await app({
        ...testConfig,
        ignore: '.forceignore',
        ignoreDestructive: '.forceignore',
        include: '.forceinclude',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with posix  path', async () => {
    expect(await app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with posix relative path', async () => {
    expect(
      await app({
        ...testConfig,
        output: './output/../output',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with windows path', async () => {
    expect(
      await app({
        ...testConfig,
        output: '.\\output',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with windows relative path', async () => {
    expect(
      await app({
        ...testConfig,
        output: '.\\output\\..\\output',
      })
    ).toHaveProperty('warnings', [])
  })

  test('catch and reject big issues', async () => {
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    fseMocked.outputFileError = true
    child_process.__setError(true)
    try {
      await app(testConfig)
    } catch (error) {
      expect(error).toBeDefined()
    }
  })
})
