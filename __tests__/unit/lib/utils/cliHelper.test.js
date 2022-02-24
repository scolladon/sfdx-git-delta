'use strict'

jest.mock('../../../../src/utils/repoSetup')
const RepoSetup = require('../../../../src/utils/repoSetup')
RepoSetup.mockImplementation(() => {
  return {
    isToEqualHead: jest.fn(),
    repoConfiguration: jest.fn(),
    computeFromRef: jest.fn(),
  }
})
jest.mock('fs')

const fsMocked = require('fs')
const CLIHelper = require('../../../../src/utils/cliHelper')

const testConfig = {
  output: 'output',
  repo: '',
  source: '',
  to: 'test',
  apiVersion: '46',
}

describe(`test if the application`, () => {
  beforeAll(() => {
    fsMocked.__setMockFiles({
      output: '',
      '.': '',
    })
  })

  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('throws errors when to parameter is not filled', async () => {
    let cliHelper = new CLIHelper({ ...testConfig, to: undefined })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when apiVersion parameter is NaN', async () => {
    let cliHelper = new CLIHelper({ ...testConfig, apiVersion: 'NotANumber' })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when output folder does not exist', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: undefined,
      output: 'not/exist/folder',
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when output is not a folder', async () => {
    let cliHelper = new CLIHelper({ ...testConfig, output: 'file' })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when repo is not git repository', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      repo: 'not/git/folder',
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when file is not found for --ignore', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      ignore: 'not-a-file',
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when file is not found for --ignore-destructive', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      ignoreDestructive: 'not-a-file',
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when file is not found for --include', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      include: 'not-a-file',
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when file is not found for --include-destructive', async () => {
    let cliHelper = new CLIHelper({
      ...testConfig,
      includeDestructive: 'not-a-file',
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  test('throws errors when "-t" and "-d" are set', async () => {
    const notHeadSHA = 'test'
    let cliHelper = new CLIHelper({
      ...testConfig,
      to: notHeadSHA,
      generateDelta: true,
    })
    try {
      await cliHelper.validateConfig()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})
