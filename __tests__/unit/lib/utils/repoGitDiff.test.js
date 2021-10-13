'use strict'
const os = require('os')
const RepoGitDiff = require('../../../../src/utils/repoGitDiff')
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
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('can parse git permissively', () => {
    const output = []
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        ignore: FORCEIGNORE_MOCK_PATH,
        ignoreWhitespace: true,
      },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('can resolve deletion', () => {
    const output = [
      'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toMatchObject(output)
  })

  test('can resolve file copy when new file is added', () => {
    const output = [
      'A      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('can resolve file copy when file is modified', () => {
    const output = [
      'M      force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('can filter ignored files', () => {
    const output = ['M      force-app/main/default/lwc/jsconfig.json']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter ignored destructive files', () => {
    const output = ['D      force-app/main/default/lwc/jsconfig.json']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignoreDestructive: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter ignored and ignored destructive files', () => {
    const output = [
      'M      force-app/main/default/lwc/jsconfig.json',
      'D      force-app/main/default/lwc/jsconfig.json',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        ignore: FORCEIGNORE_MOCK_PATH,
        ignoreDestructive: FORCEIGNORE_MOCK_PATH,
      },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter deletion if only ignored is specified files', () => {
    const output = ['D      force-app/main/default/lwc/jsconfig.json']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('cannot filter non deletion if only ignored destructive is specified files', () => {
    const output = ['A      force-app/main/default/lwc/jsconfig.json']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignoreDestructive: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('can filter sub folders', () => {
    const output = ['M      force-app/main/default/pages/Account.page']
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output[0],
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter moved files', () => {
    const output = [
      'D      force-app/main/default/classes/Account.cls',
      'A      force-app/account/domain/classes/Account.cls',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output.join(os.EOL),
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    const expected = [output[1]]
    expect(work).toStrictEqual(expected)
  })

  test('can filter case changed files', () => {
    const output = [
      'D      force-app/main/default/objects/Account/fields/TEST__c.field-meta.xml',
      'A      force-app/main/default/objects/Account/fields/Test__c.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output.join(os.EOL),
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    const expected = [output[1]]
    expect(work).toStrictEqual(expected)
  })

  test('cannot filter renamed files', () => {
    const output = [
      'D      force-app/main/default/classes/Account.cls',
      'A      force-app/main/default/classes/RenamedAccount.cls',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output.join(os.EOL),
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('cannot filter same name file with different metadata', () => {
    const output = [
      'D      force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml',
      'A      force-app/main/default/objects/Opportunity/fields/CustomField__c.field-meta.xml',
    ]
    child_process.spawnSync.mockImplementation(() => ({
      stdout: output.join(os.EOL),
    }))
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    const work = repoGitDiff.getDiff()
    expect(work).toStrictEqual(output)
  })

  test('can reject in case of error', () => {
    const expected = new Error('Test Error')
    child_process.spawnSync.mockImplementation(() => {
      throw expected
    })
    try {
      const repoGitDiff = new RepoGitDiff({ output: '', repo: '' }, null)
      repoGitDiff.getDiff()
    } catch (e) {
      expect(e).toBe(expected)
    }
  })
})
