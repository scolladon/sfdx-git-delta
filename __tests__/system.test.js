'use strict'
const app = require('../src/main')
const { COMMIT_REF_TYPE, GIT_FOLDER } = require('../src/utils/gitConstants')
const fs = require('fs')

jest.mock('child_process')
jest.mock('fs')
jest.mock('fs-extra')
const child_process = require('child_process')

const testConfig = {
  output: 'output',
  repo: '',
  source: '',
  to: 'test',
  from: 'main',
  apiVersion: '46',
}

describe(`test if the appli`, () => {
  beforeAll(() => {
    fs.__setMockFiles({
      output: '',
      [GIT_FOLDER]: '',
      '.': '',
      '.forceignore': '',
      '.forceinclude': '',
    })
  })

  beforeEach(() => {
    child_process.__setOutput([[], [], [COMMIT_REF_TYPE], [COMMIT_REF_TYPE]])
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
})
