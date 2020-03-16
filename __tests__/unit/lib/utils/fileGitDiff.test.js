'use strict'
const fileGitDiff = require('../../../../lib/utils/fileGitDiff')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

const TEST_PATH = 'path/to/file'

describe(`test if fileGitDiff`, () => {
  test('can parse git diff header', async () => {
    const output = '@git diff'
    mySpawn.setDefault(mySpawn.simple(0, output))
    const result = await fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(result).toStrictEqual(output)
  })

  test('can parse git diff addition', async () => {
    const output = '+ line added'

    mySpawn.setDefault(mySpawn.simple(0, output))
    const work = await fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can parse git diff deletion', async () => {
    const output = '- line deleted'

    mySpawn.setDefault(mySpawn.simple(0, output))
    const work = await fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can parse git diff contexte line', async () => {
    const output = 'context line'

    mySpawn.setDefault(mySpawn.simple(0, output))
    const work = await fileGitDiff(TEST_PATH, { output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can reject in case of error', async () => {
    const expected = 'Test Error'
    mySpawn.setDefault(mySpawn.simple(1, null, expected))

    try {
      await fileGitDiff(TEST_PATH, { output: '', repo: '' })
    } catch (e) {
      expect(e).toBe(expected)
    }
  })
})
