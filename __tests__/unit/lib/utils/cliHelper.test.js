'use strict'
const child_process = require('child_process')
const fs = require('fs')
const {
  COMMIT_REF_TYPE,
  TAG_REF_TYPE,
} = require('../../../../src/utils/gitConstants')
const RepoSetup = require('../../../../src/utils/repoSetup')
const CLIHelper = require('../../../../src/utils/cliHelper')
const {
  getLatestSupportedVersion,
} = require('../../../../src/metadata/metadataManager')
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
  config: {
    output: 'output',
    repo: '',
    source: '',
    to: 'test',
    apiVersion: '46',
  },
  warnings: [],
}

const mockFiles = {
  output: '',
  '.': '',
}

describe(`test if the application`, () => {
  beforeEach(() => {
    fs.errorMode = false
    fs.statErrorMode = false
    fs.__setMockFiles(mockFiles)
  })

  test('throws errors when to parameter is not filled', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: undefined,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when apiVersion parameter is NaN', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: 'NotANumber',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when fs.stat throw error', async () => {
    fs.statErrorMode = true
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: undefined,
        output: 'stat/error',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when output folder does not exist', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: undefined,
        output: 'not/exist/folder',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when output is not a folder', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: undefined,
        output: 'file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when repo is not git repository', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        repo: 'not/git/folder',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --ignore', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        ignore: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --ignore-destructive', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        ignoreDestructive: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --include', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        include: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when file is not found for --include-destructive', async () => {
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        includeDestructive: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when "-t" and "-d" are set', async () => {
    const notHeadSHA = 'test'
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: notHeadSHA,
        generateDelta: true,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  test('throws errors when "-t" is not a git expression', async () => {
    const emptyString = ''
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorGitSHAisBlank, 'to', emptyString)
    )
  })

  test('throws errors when "-f" is not a git expression', async () => {
    const emptyString = ''
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        from: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorGitSHAisBlank, 'from', emptyString)
    )
  })

  test('throws errors when "-t" is not a valid sha pointer', async () => {
    child_process.__setOutput([[TAG_REF_TYPE], ['not a valid sha pointer']])
    const notHeadSHA = 'test'
    const cliHelper = new CLIHelper({
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
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        from: notHeadSHA,
        generateDelta: false,
      },
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
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        to: notHeadSHA,
        from: notHeadSHA,
        generateDelta: false,
      },
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

    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(2)
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'to', COMMIT_REF_TYPE)
    )
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'from', TAG_REF_TYPE)
    )
  })

  test('do not throw errors when repo contains submodule git file', async () => {
    fs.__setMockFiles({
      ...mockFiles,
      'submodule/.git': 'lorem ipsum',
    })
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        repo: 'submodule/',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorPathIsNotGit, 'submodule/')
    )
  })

  test('do not throw errors when repo submodule git folder', async () => {
    fs.__setMockFiles({
      ...mockFiles,
      'submodule/.git': '',
    })
    const cliHelper = new CLIHelper({
      ...testConfig,
      config: {
        ...testConfig.config,
        repo: 'submodule/',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorPathIsNotGit, 'submodule/.git')
    )
  })

  describe('apiVersion parameter handling', () => {
    let latestAPIVersionSupported
    beforeAll(async () => {
      latestAPIVersionSupported = await getLatestSupportedVersion()
    })
    describe('when apiVersion parameter is set with supported value', () => {
      test.each([46, 52, 55])(
        'config.apiVersion (%s) equals the parameter',
        async version => {
          // Arrange
          const work = {
            ...testConfig,
            config: {
              ...testConfig.config,
              apiVersion: version,
            },
            warnings: [],
          }
          const cliHelper = new CLIHelper(work)

          // Act
          await cliHelper._handleDefault()

          // Assert
          expect(work.config.apiVersion).toEqual(version)
          expect(work.warnings.length).toEqual(0)
        }
      )
    })
    describe('when apiVersion parameter is set with unsupported value', () => {
      test.each(['NaN', '40', '55.1', 'awesome', '1000000000', 0])(
        `config.apiVersion (%s) equals the latest version `,
        async version => {
          // Arrange
          const work = {
            ...testConfig,
            config: {
              ...testConfig.config,
              apiVersion: version,
            },
            warnings: [],
          }
          const cliHelper = new CLIHelper(work)

          // Act
          await cliHelper._handleDefault()

          // Assert
          expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
          expect(work.warnings.length).toEqual(1)
        }
      )
    })

    describe('when apiVersion parameter is not set', () => {
      describe('when sfdx-project.json file exist', () => {
        describe('when "sourceApiVersion" attribut is set with supported value', () => {
          test.each(['46', '52', '55', '46.0', '52.0', '55.0'])(
            'config.apiVersion (%s) equals the "sourceApiVersion" attribut',
            async version => {
              // Arrange
              fs.__setMockFiles({
                ...mockFiles,
                'sfdx-project.json': `{"sourceApiVersion":${version}}`,
              })

              const work = {
                ...testConfig,
                config: {
                  ...testConfig.config,
                  apiVersion: undefined,
                },
                warnings: [],
              }
              const cliHelper = new CLIHelper(work)

              // Act
              await cliHelper._handleDefault()

              // Assert
              expect(work.config.apiVersion).toEqual(+version)
              expect(work.warnings.length).toEqual(0)
            }
          )
        })
        describe('when "sourceApiVersion" attribut is set with unsupported value', () => {
          test.each([NaN, '40', 'awesome', 1000000000, ''])(
            'config.apiVersion (%s) equals the latest version',
            async version => {
              // Arrange
              fs.__setMockFiles({
                ...mockFiles,
                'sfdx-project.json': `{"sourceApiVersion":"${version}"}`,
              })

              const work = {
                ...testConfig,
                config: {
                  ...testConfig.config,
                  apiVersion: undefined,
                },
                warnings: [],
              }
              const cliHelper = new CLIHelper(work)

              // Act
              await cliHelper._handleDefault()

              // Assert
              expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
              expect(work.warnings.length).toEqual(1)
            }
          )
        })
      })
      describe('when sfdx-project.json file does not exist', () => {
        test('config.apiVersion equals the latest version', async () => {
          // Arrange
          const work = {
            ...testConfig,
            config: {
              ...testConfig.config,
              apiVersion: undefined,
            },
            warnings: [],
          }
          const cliHelper = new CLIHelper(work)

          // Act
          await cliHelper._handleDefault()

          // Assert
          expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
          expect(work.warnings.length).toEqual(0)
        })
      })
    })
  })
})
