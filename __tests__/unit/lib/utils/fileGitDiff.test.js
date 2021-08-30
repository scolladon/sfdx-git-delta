'use strict'
const fileGitDiff = require('../../../../src/utils/fileGitDiff')
const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')

const TEST_PATH = 'path/to/file'

describe(`test if fileGitDiff`, () => {
  test('can parse git diff header', () => {
    const output = '@git diff'
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output,
    }))
    const result = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(result).toStrictEqual(output)
  })

  test('can parse git diff addition', () => {
    const output = '+ line added'

    child_process.spawnSync.mockImplementation(() => ({
      stdout: output,
    }))
    const work = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can parse git diff deletion', () => {
    const output = '- line deleted'

    child_process.spawnSync.mockImplementation(() => ({
      stdout: output,
    }))
    const work = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can apply permissive git diff', () => {
    const output = 'diff'

    child_process.spawnSync.mockImplementation(() => ({
      stdout: output,
    }))
    const work = fileGitDiff(TEST_PATH, {
      output: '',
      repo: '',
      permissiveDiff: true,
    })
    expect(work).toStrictEqual(output)
  })

  test('can parse git diff context line', () => {
    const output = 'context line'

    child_process.spawnSync.mockImplementation(() => ({
      stdout: output,
    }))
    const work = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can reject in case of error', () => {
    const expected = new Error('Test Error')
    child_process.spawnSync.mockImplementation(() => {
      throw expected
    })

    try {
      fileGitDiff(TEST_PATH, { output: '', repo: '' })
    } catch (e) {
      expect(e).toBe(expected)
    }
  })
})
