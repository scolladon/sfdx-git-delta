'use strict'
import { format } from 'util'

import { describe, expect, it, jest } from '@jest/globals'

import messages from '../../../../src/locales/en'
import { getLatestSupportedVersion } from '../../../../src/metadata/metadataManager'
import type { Work } from '../../../../src/types/work'
import CLIHelper from '../../../../src/utils/cliHelper'
import {
  dirExists,
  fileExists,
  pathExists,
  readFile,
  sanitizePath,
} from '../../../../src/utils/fsUtils'
import { getWork } from '../../../__utils__/globalTestHelper'

const mockParseRev = jest.fn()
const mockConfigureRepository = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => ({
  getInstance: () => ({
    parseRev: mockParseRev,
    configureRepository: mockConfigureRepository,
  }),
}))

jest.mock('../../../../src/utils/fsUtils')
const mockedPathExists = jest.mocked(pathExists)
const mockedReadFile = jest.mocked(readFile)
const mockedSanitizePath = jest.mocked(sanitizePath)
const mockedDirExists = jest.mocked(dirExists)
const mockedFileExists = jest.mocked(fileExists)

mockedSanitizePath.mockImplementation(data => data)

describe(`test if the application`, () => {
  let work: Work
  beforeEach(() => {
    work = getWork()
    work.config.repo = '.'
    work.config.to = 'test'
    work.config.apiVersion = 46
    mockedFileExists.mockImplementation(() => Promise.resolve(true))
    mockedDirExists.mockImplementation(() => Promise.resolve(true))
    mockedPathExists.mockResolvedValue(true as never)
    mockParseRev.mockImplementation(() => Promise.resolve('ref'))
  })

  it('resume nicely when everything is well configured', async () => {
    // Arrange
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: 'notblank',
        from: 'HEAD',
      },
    })

    // Act
    await cliHelper.validateConfig()

    // Assert
    expect(1).toBe(1)
  })

  it('add errors when repo is not a git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when output parameter does not exist', async () => {
    mockedDirExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when repo parameter does not exist', async () => {
    mockedDirExists.mockResolvedValueOnce(true)
    mockedDirExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when source parameter does not exist', async () => {
    mockedDirExists.mockResolvedValueOnce(true)
    mockedDirExists.mockResolvedValueOnce(true)
    mockedDirExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when ignore parameter does not exist', async () => {
    mockedFileExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when ignoreDestructive parameter does not exist', async () => {
    mockedFileExists.mockResolvedValueOnce(true)
    mockedFileExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when include parameter does not exist', async () => {
    mockedFileExists.mockResolvedValueOnce(true)
    mockedFileExists.mockResolvedValueOnce(true)
    mockedFileExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when includeDestructive parameter does not exist', async () => {
    mockedFileExists.mockResolvedValueOnce(true)
    mockedFileExists.mockResolvedValueOnce(true)
    mockedFileExists.mockResolvedValueOnce(true)
    mockedFileExists.mockResolvedValueOnce(false)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when to parameter is not filled', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when output folder does not exist', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
        output: 'not/exist/folder',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when output is not a folder', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: '',
        output: 'file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when repo is not git repository', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        repo: 'not/git/folder',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when file is not found for --ignore', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        ignore: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when file is not found for --ignore-destructive', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        ignoreDestructive: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when file is not found for --include', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        include: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when file is not found for --include-destructive', async () => {
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        includeDestructive: 'not-a-file',
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" and "-d" are set', async () => {
    const notHeadSHA = 'test'
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        generateDelta: true,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a git expression', async () => {
    const emptyString = ''
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorGitSHAisBlank, 'to', emptyString)
    )
  })

  it('throws errors when "-f" is not a git expression', async () => {
    const emptyString = ''
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        from: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorGitSHAisBlank, 'from', emptyString)
    )
  })

  it('throws errors when "-t" is not a valid sha pointer', async () => {
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'to', notHeadSHA)
    )
  })

  it('throws errors when "-f" is not a valid sha pointer', async () => {
    mockParseRev.mockImplementationOnce(() => Promise.resolve('ref'))
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(cliHelper.validateConfig()).rejects.toThrow(
      format(messages.errorParameterIsNotGitSHA, 'from', notHeadSHA)
    )
  })

  it('throws errors when "-t" and "-f" are not a valid sha pointer', async () => {
    expect.assertions(2)
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        from: notHeadSHA,
        generateDelta: false,
      },
    })

    try {
      await cliHelper.validateConfig()
    } catch (err) {
      const error = err as Error
      expect(error.message).toContain(
        format(messages.errorParameterIsNotGitSHA, 'from', notHeadSHA)
      )
      expect(error.message).toContain(
        format(messages.errorParameterIsNotGitSHA, 'to', notHeadSHA)
      )
    }
  })

  it('do not throw errors when "-t" and "-f" are valid sha pointer', async () => {
    // Arrange
    const notHeadSHA = 'test'

    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })

    // Act
    await cliHelper.validateConfig()

    // Assert
    expect(1).toBe(1)
  })

  it('do not throw errors when repo contains submodule git file', async () => {
    expect.assertions(1)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        repo: 'submodule/',
      },
    })
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorPathIsNotGit, 'submodule/')
    )
  })

  it('do not throw errors when repo submodule git folder', async () => {
    expect.assertions(1)
    const cliHelper = new CLIHelper({
      ...work,
      config: {
        ...work.config,
        repo: 'submodule/',
      },
    })
    await expect(cliHelper.validateConfig()).rejects.not.toThrow(
      format(messages.errorPathIsNotGit, 'submodule/.git')
    )
  })

  describe('apiVersion parameter handling', () => {
    let latestAPIVersionSupported: number
    beforeAll(async () => {
      latestAPIVersionSupported = await getLatestSupportedVersion()
    })
    beforeEach(jest.resetAllMocks)
    describe('when apiVersion parameter is set with supported value', () => {
      it.each([46, 52, 55])(
        'config.apiVersion (%s) equals the parameter',
        async version => {
          // Arrange
          work.config.apiVersion = version
          const cliHelper = new CLIHelper(work)

          // Act
          await cliHelper['_handleDefault']()

          // Assert
          expect(work.config.apiVersion).toEqual(version)
          expect(work.warnings.length).toEqual(0)
        }
      )
    })
    describe('when apiVersion parameter is set with unsupported value', () => {
      it.each([NaN, 40, 55.1, 0])(
        `config.apiVersion (%s) equals the latest version `,
        async version => {
          // Arrange
          mockedFileExists.mockImplementation(() => Promise.resolve(false))
          work.config.apiVersion = version
          const cliHelper = new CLIHelper(work)

          // Act
          await cliHelper['_handleDefault']()

          // Assert
          expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
          expect(work.warnings.length).toEqual(1)
        }
      )
    })

    describe('when apiVersion parameter is not set', () => {
      describe('when sfdx-project.json file exist', () => {
        beforeEach(() => {
          mockedFileExists.mockImplementation(() => Promise.resolve(true))
        })
        describe('when "sourceApiVersion" attribute is set with supported value', () => {
          it.each([46, 52, 53, 46.0, 52.0, 55.0])(
            'config.apiVersion (%s) equals the "sourceApiVersion" attribute',
            async version => {
              // Arrange
              mockedReadFile.mockImplementation(() =>
                Promise.resolve(`{"sourceApiVersion":"${version}"}`)
              )

              work.config.apiVersion = -1
              const cliHelper = new CLIHelper(work)

              // Act
              await cliHelper['_handleDefault']()

              // Assert
              expect(work.config.apiVersion).toEqual(+version)
              expect(work.warnings.length).toEqual(0)
            }
          )
        })
        describe('when "sourceApiVersion" attribute is set with unsupported value', () => {
          it.each([NaN, '40', 'awesome', 1000000000, ''])(
            'config.apiVersion (%s) equals the latest version',
            async version => {
              // Arrange
              mockedReadFile.mockResolvedValue(
                `{"sourceApiVersion":"${version}"}`
              )

              work.config.apiVersion = -1
              const cliHelper = new CLIHelper(work)

              // Act
              await cliHelper['_handleDefault']()

              // Assert
              expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
              expect(work.warnings.length).toEqual(1)
            }
          )
        })

        it('when "sourceApiVersion" attribute is not set', async () => {
          // Arrange
          mockedReadFile.mockResolvedValue('{}')

          work.config.apiVersion = -1
          const cliHelper = new CLIHelper(work)

          // Act
          await cliHelper['_handleDefault']()

          // Assert
          expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
          expect(work.warnings.length).toEqual(1)
        })
      })
    })
    describe('when sfdx-project.json file does not exist', () => {
      it('config.apiVersion equals the latest version', async () => {
        // Arrange
        mockedFileExists.mockImplementation(() => Promise.resolve(false))
        work.config.apiVersion = -1
        const cliHelper = new CLIHelper(work)

        // Act
        await cliHelper['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(work.warnings.length).toEqual(1)
      })
    })
  })
})
