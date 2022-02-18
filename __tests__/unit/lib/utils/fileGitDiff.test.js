'use strict'
const fileGitDiff = require('../../../../src/utils/fileGitDiff')
jest.mock('child_process')
const child_process = require('child_process')

const TEST_PATH = 'path/to/file'

describe(`test if fileGitDiff`, () => {
  beforeEach(() => {
    child_process.__setOutput([])
    child_process.__setError(false)
  })
  test('can parse git diff header', async () => {
    const output = ['@git diff']
    child_process.__setOutput([output])
    const result = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    for await (const line of result) {
      expect(line).toStrictEqual(output.shift())
    }
  })

  test('can parse git diff addition', async () => {
    const output = ['+ line added']

    child_process.__setOutput([output])
    const result = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    for await (const line of result) {
      expect(line).toStrictEqual(output.shift())
    }
  })

  test('can parse git diff deletion', async () => {
    const output = ['- line deleted']

    child_process.__setOutput([output])
    const result = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    for await (const line of result) {
      expect(line).toStrictEqual(output.shift())
    }
  })

  test('can apply permissive git diff', async () => {
    const output = ['diff']

    child_process.__setOutput([output])
    const result = fileGitDiff(TEST_PATH, {
      output: '',
      repo: '',
      ignoreWhitespace: true,
    })
    for await (const line of result) {
      expect(line).toStrictEqual(output.shift())
    }
  })

  test('can parse git diff context line', async () => {
    const output = ['context line']

    child_process.__setOutput([output])
    const result = fileGitDiff(TEST_PATH, { output: '', repo: '' })
    for await (const line of result) {
      expect(line).toStrictEqual(output.shift())
    }
  })

  test('can reject in case of error', () => {
    child_process.__setError(true)

    try {
      fileGitDiff(TEST_PATH, { output: '', repo: '' })
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})
