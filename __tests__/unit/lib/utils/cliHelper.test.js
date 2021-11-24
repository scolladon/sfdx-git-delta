'use strict'
const CLIHelper = require('../../../../src/utils/cliHelper')
const gc = require('../../../../src/utils/gitConstants')

const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')
jest.mock('git-state')
jest.mock('fast-xml-parser')

const fsMocked = require('fs')
const fseMocked = require('fs-extra')

const testConfig = {
  output: 'output',
  repo: '',
  source: '',
  to: 'test',
  apiVersion: '46',
}

describe(`test if the appli`, () => {
  let cliHelper
  beforeAll(() => {
    fsMocked.errorMode = false
    fseMocked.errorMode = false
    fseMocked.outputFileSyncError = false
    fsMocked.__setMockFiles({
      output: '',
      '.': '',
    })
    child_process.spawnSync.mockImplementation(() => ({ stdout: '' }))
  })

  test('throw errors when to parameter is not filled', () => {
    cliHelper = new CLIHelper({ ...testConfig, to: undefined })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when apiVersion parameter is NaN', () => {
    cliHelper = new CLIHelper({ ...testConfig, apiVersion: 'NotANumber' })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when output folder does not exist', () => {
    cliHelper = new CLIHelper({ ...testConfig, to: undefined })
    expect(() => {
      cliHelper.validateConfig({
        ...testConfig,
        output: 'not/exist/folder',
      })
    }).toThrow()
  })

  test('throw errors when output is not a folder', () => {
    cliHelper = new CLIHelper({ ...testConfig, output: 'file' })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when repo is not git repository', () => {
    cliHelper = new CLIHelper({
      ...testConfig,
      repo: 'not/git/folder',
    })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when file is not found for --ignore', () => {
    cliHelper = new CLIHelper({
      ...testConfig,
      ignore: 'not-a-file',
    })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when file is not found for --ignore-destructive', () => {
    cliHelper = new CLIHelper({
      ...testConfig,
      ignoreDestructive: 'not-a-file',
    })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when file is not found for --include', () => {
    cliHelper = new CLIHelper({
      ...testConfig,
      include: 'not-a-file',
    })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when file is not found for --include-destructive', () => {
    cliHelper = new CLIHelper({
      ...testConfig,
      includeDestructive: 'not-a-file',
    })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })

  test('throw errors when "-t" and "-d" are set', () => {
    const notHeadSHA = 'test'
    child_process.spawnSync
      .mockReturnValueOnce({ stdout: Buffer.from('HEAD', gc.UTF8_ENCODING) })
      .mockReturnValueOnce({
        stdout: Buffer.from(notHeadSHA, gc.UTF8_ENCODING),
      })
    cliHelper = new CLIHelper({
      ...testConfig,
      to: notHeadSHA,
      generateDelta: true,
    })
    expect(() => {
      cliHelper.validateConfig()
    }).toThrow()
  })
})
