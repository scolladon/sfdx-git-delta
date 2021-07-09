'use strict'
const app = require('../../src/main')
const gc = require('../../src/utils/gitConstants')

const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')
jest.mock('git-state')
jest.mock('fast-xml-parser')

const fsMocked = require('fs')
const fseMocked = require('fs-extra')

describe(`test if the appli`, () => {
  beforeAll(() => {
    fsMocked.errorMode = false
    fseMocked.errorMode = false
    fseMocked.outputFileSyncError = false
    fsMocked.__setMockFiles({
      output: '',
    })
    child_process.spawnSync.mockImplementation(() => ({ stdout: '' }))
  })

  test('can execute with simple parameters and no diff', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and an Addition', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and a Deletion', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with simple parameters and a Modification', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with complex parameters and a Modification', () => {
    expect(
      app({
        output: 'output',
        repo: '',
        to: 'test',
        apiVersion: '46',
        ignore: '.forceignore',
        ignoreDestructive: '.forceignore',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with posix  path', () => {
    expect(
      app({ output: './output', repo: '', to: 'test', apiVersion: '46' })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with posix relative path', () => {
    expect(
      app({
        output: './output/../output',
        repo: '',
        to: 'test',
        apiVersion: '46',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with windows path', () => {
    expect(
      app({
        output: '.\\output',
        repo: '',
        to: 'test',
        apiVersion: '46',
      })
    ).toHaveProperty('warnings', [])
  })

  test('can execute with windows relative path', () => {
    expect(
      app({
        output: '.\\output\\..\\output',
        repo: '',
        to: 'test',
        apiVersion: '46',
      })
    ).toHaveProperty('warnings', [])
  })

  test('catch and reject big issues', () => {
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    fseMocked.outputFileSyncError = true
    expect(() => {
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    }).toThrow()
  })

  test('throw errors when to parameter is not filled', () => {
    expect(() => {
      app({ output: 'output', repo: '', apiVersion: '46' })
    }).toThrow()
  })

  test('throw errors when apiVersion parameter is NaN', () => {
    expect(() => {
      app({ output: 'output', repo: '', to: 'test', apiVersion: 'NotANumber' })
    }).toThrow()
  })

  test('throw errors when output folder does not exist', () => {
    expect(() => {
      app({
        output: 'not/exist/folder',
        repo: '',
        to: 'test',
        apiVersion: '46',
      })
    }).toThrow()
  })

  test('throw errors when output is not a folder', () => {
    expect(() => {
      app({ output: 'file', repo: '', to: 'test', apiVersion: '46' })
    }).toThrow()
  })

  test('throw errors when repo is not git repository', () => {
    expect(() => {
      app({
        output: 'output',
        repo: 'not/git/folder',
        to: 'test',
        apiVersion: '46',
      })
    }).toThrow()
  })

  test('throw errors when "-t" and "-d" are set', () => {
    const notHeadSHA = 'test'
    /*const child_process = require('child_process')
    jest.mock('child_process', () => ({ spawnSync: jest.fn() }))*/
    child_process.spawnSync
      .mockReturnValueOnce({ stdout: Buffer.from('HEAD', gc.UTF8_ENCODING) })
      .mockReturnValueOnce({
        stdout: Buffer.from(notHeadSHA, gc.UTF8_ENCODING),
      })
    expect(() => {
      app({
        output: 'output',
        repo: '',
        to: notHeadSHA,
        generateDelta: true,
        apiVersion: '46',
      })
    }).toThrow()
  })
})
