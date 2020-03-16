'use strict'
const repoGitDiff = require('../../../../lib/utils/repoGitDiff')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

describe(`test if diffHandler`, () => {
  test('can parse git correctly', async () => {
    const output = []
    mySpawn.setDefault(mySpawn.simple(0, ''))
    const work = await repoGitDiff({ output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can resolve destructive change', async () => {
    const output = [
      'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mySpawn.setDefault(mySpawn.simple(0, output[0]))
    const work = await repoGitDiff({ output: '', repo: '' })
    expect(work).toMatchObject(output)
  })

  test('can resolve file copy when new file is added', async () => {
    const output = [
      'A      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mySpawn.setDefault(mySpawn.simple(0, output[0]))
    const work = await repoGitDiff({ output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can resolve file copy when file is modified', async () => {
    const output = [
      'M      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mySpawn.setDefault(mySpawn.simple(0, output[0]))
    const work = await repoGitDiff({ output: '', repo: '' })
    expect(work).toStrictEqual(output)
  })

  test('can reject in case of error', async () => {
    const expected = 'Test Error'
    mySpawn.setDefault(mySpawn.simple(1, null, expected))

    try {
      await repoGitDiff({ output: '', repo: '' })
    } catch (e) {
      expect(e).toBe(expected)
    }
  })
})
