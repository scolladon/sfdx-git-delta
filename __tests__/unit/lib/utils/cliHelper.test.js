'use strict'
const child_process = require('child_process')
const fs = require('fs')
const {
  COMMIT_REF_TYPE,
  TAG_REF_TYPE,
} = require('../../../../src/utils/gitConstants')
const RepoSetup = require('../../../../src/utils/repoSetup')
const CLIHelper = require('../../../../src/utils/cliHelper')
const messages = require('../../../../src/locales/en')
const { format } = require('util')
jest.mock('fs')
jest.mock('child_process')
jest.mock('../../../../src/utils/repoSetup')
RepoSetup.mockImplementation(() => ({
  isToEqualHead: jest.fn(),
  repoConfiguration: jest.fn(),
  getCommitRefType: jest.fn(),
}))

const testConfig = {
  output: 'output',
  repo: '',
  source: '',
  to: 'test',
  apiVersion: '46',
}

describe(`test if the application`, () => {
  beforeAll(() => {
    fs.errorMode = false
    fs.statErrorMode = false
    fs.__setMockFiles({
      output: '',
      '.': '',
    })
  })

  test('throws errors when to parameter is not filled', async () => {
    let cliHelper = new CLIHelper({ ...testConfig, to: undefined })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when apiVersion parameter is NaN', async () => {
    let cliHelper = new CLIHelper({ ...testConfig, apiVersion: 'NotANumber' })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when fs.stat throw error', async () => {
    fs.statErrorMode = true
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: undefined,
      output: 'stat/error',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when output folder does not exist', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: undefined,
      output: 'not/exist/folder',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when output is not a folder', async () => {
    let cliHelper = new CLIHelper({ ...testConfig, output: 'file' })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when repo is not git repository', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      repo: 'not/git/folder',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --ignore', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      ignore: 'not-a-file',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --ignore-destructive', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      ignoreDestructive: 'not-a-file',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --include', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      include: 'not-a-file',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --include-destructive', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      includeDestructive: 'not-a-file',
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when "-t" and "-d" are set', async () => {
    const notHeadSHA = 'test'
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: notHeadSHA,
      generateDelta: true,
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when "-t" is not a git expression', async () => {
    const emptyString = ''
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: emptyString,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorGitSHAisBlank, 'to', emptyString)
    )
  })

  test('throws errors when "-f" is not a git expression', async () => {
    const emptyString = ''
    let cliHelper = new CLIHelper({
      ...testConfig,
      from: emptyString,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorGitSHAisBlank, 'from', emptyString)
    )
  })

  test('throws errors when "-t" is not a valid sha pointer', async () => {
    child_process.__setOutput([[TAG_REF_TYPE], ['not a valid sha pointer']])
    const notHeadSHA = 'test'
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: notHeadSHA,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'to', notHeadSHA)
    )
  })

  test('throws errors when "-f" is not a valid sha pointer', async () => {
    child_process.__setOutput([['not a valid sha pointer'], [COMMIT_REF_TYPE]])
    const notHeadSHA = 'test'
    let cliHelper = new CLIHelper({
      ...testConfig,
      from: notHeadSHA,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'from', notHeadSHA)
    )
  })

  test('throws errors when "-t" and "-f" are not a valid sha pointer', async () => {
    child_process.__setOutput([
      ['not a valid sha pointer'],
      ['not a valid sha pointer'],
    ])
    const notHeadSHA = 'test'
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: notHeadSHA,
      from: notHeadSHA,
      generateDelta: false,
    })
    expect.assertions(2)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'to', notHeadSHA)
    )
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'from', notHeadSHA)
    )
  })

  test('do not throw errors when "-t" and "-f" are valid sha pointer', async () => {
    child_process.__setOutput([[TAG_REF_TYPE], [COMMIT_REF_TYPE]])
    const notHeadSHA = 'test'
    let cliHelper = new CLIHelper({
      ...testConfig,
      from: notHeadSHA,
      generateDelta: false,
    })
    expect.assertions(2)
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'to', COMMIT_REF_TYPE)
    )
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'from', TAG_REF_TYPE)
    )
  })
})
