'use strict'
const repoGitDiff = require('../../../../lib/utils/repoGitDiff')
const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')

describe(`test if repoGitDiff`, () => {
  test('can parse git correctly', () => {
    const output = []
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const work = repoGitDiff({ output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can resolve deletion', () => {
    const output = [
      'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const work = repoGitDiff({ output: '', repo: '' })
    expect(work).toMatchObject(output)
  })

  test('can resolve file copy when new file is added', () => {
    const output = [
      'A      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const work = repoGitDiff({ output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can resolve file copy when file is modified', () => {
    const output = [
      'M      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const work = repoGitDiff({ output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can reject in case of error', () => {
    const expected = new Error('Test Error')
    child_process.spawnSync.mockImplementation(() => {
      throw expected
    })
    try {
      repoGitDiff({ output: '', repo: '' })
    } catch (e) {
      expect(e).toBe(expected)
    }
  })
})
