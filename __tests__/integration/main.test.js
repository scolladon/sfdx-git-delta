'use strict'
const app = require('../../src/main')
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
    child_process.spawn.mockImplementation(() => {
      const mock = new EventEmitter()
      mock.stdout = new Readable({
        read() {
          this.push('')
          this.push(null)
          mock.emit('close')
        },
      })
      return mock
    })
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

  test('catch and reject big issues', () => {
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    fseMocked.outputFileSyncError = true
    expect(async () => await app(testConfig)).toThrow()
  })
})
