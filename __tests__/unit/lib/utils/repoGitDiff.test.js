'use strict'
const repoGitDiff = require('../../../../src/utils/repoGitDiff')
const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')

const FORCEIGNORE_MOCK_PATH = '__mocks__/.forceignore'

describe(`test if repoGitDiff`, () => {
  test('can parse git correctly', () => {
    const output = []
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const work = repoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    expect(work).toStrictEqual(output)
  })

  test('can resolve deletion', () => {
    const output = [
      'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const work = repoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    expect(work).toMatchObject(output)
  })

  test('can resolve file copy when new file is added', () => {
    const output = [
      'A      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    // eslint-disable-next-line no-undef
    const work = repoGitDiff({ output: '', repo: '' }, globalMetadata)
    expect(work).toStrictEqual(output)
  })

  test('can resolve file copy when file is modified', () => {
    const output = [
      'M      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    // eslint-disable-next-line no-undef
    const work = repoGitDiff({ output: '', repo: '' }, globalMetadata)
    expect(work).toStrictEqual(output)
  })

  test('can filter ignored files', () => {
    const output = ['M      force-app/main/default/lwc/jsconfig.json']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const work = repoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter sub folders', () => {
    const output = ['M      force-app/main/default/pages/Account.page']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const work = repoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
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
