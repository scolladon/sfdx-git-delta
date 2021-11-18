'use strict'
const app = require('../../src/main')

const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')
jest.mock('git-state')
jest.mock('fast-xml-parser')

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
    fseMocked.outputFileSyncError = false
    fsMocked.__setMockFiles({
      output: '',
      '.': '',
      '.forceignore': '',
      '.forceinclude': '',
    })
    child_process.spawnSync.mockImplementation(() => ({ stdout: '' }))
  })

  test('can execute with simple parameters and no diff', () => {
    expect(app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and an Addition', () => {
    expect(app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and a Deletion', () => {
    expect(app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and a Modification', () => {
    expect(app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with complex parameters and a Modification', () => {
    expect(
      app({
        ...testConfig,
        ignore: '.forceignore',
        ignoreDestructive: '.forceignore',
        include: '.forceinclude',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with posix  path', () => {
    expect(app(testConfig)).toHaveProperty('warnings', [])
  })

  test('can execute with posix relative path', () => {
    expect(
      app({
        ...testConfig,
        output: './output/../output',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with windows path', () => {
    expect(
      app({
        ...testConfig,
        output: '.\\output',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with windows relative path', () => {
    expect(
      app({
        ...testConfig,
        output: '.\\output\\..\\output',
      })
    ).toHaveProperty('warnings', [])
  })

  test('catch and reject big issues', () => {
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    fseMocked.outputFileSyncError = true
    expect(() => {
      app(testConfig)
    }).toThrow()
  })
})
