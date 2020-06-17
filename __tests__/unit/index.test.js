'use strict'
const app = require('../../index')
jest.mock('child_process')
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
    fsMocked.__setMockFiles({
      output: '',
    })
  })

  test('can execute with simple parameters and no diff', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toBeUndefined()
  })

  test('can execute with simple parameters and an Addition', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toBeUndefined()
  })

  test('can execute with simple parameters and a Deletion', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toBeUndefined()
  })

  test('can execute with simple parameters and a Modification', () => {
    expect(
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    ).toBeUndefined()
  })

  test('catch and reject big issues', () => {
    fsMocked.errorMode = true
    fseMocked.errorMode = true
    expect(() => {
      app({ output: 'output', repo: '', to: 'test', apiVersion: '46' })
    }).toThrow()
  })

  test('catch internal qwaks', () => {
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
})
