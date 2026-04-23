import { stat } from 'node:fs/promises'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SDRMetadataAdapter } from '../../../../src/metadata/sdrMetadataAdapter'
import type { Work } from '../../../../src/types/work'
import ConfigValidator from '../../../../src/utils/configValidator'
import { pathExists, sanitizePath } from '../../../../src/utils/fsUtils'
import { getWork } from '../../../__utils__/testWork'

const {
  mockGetMessage,
  mockParseRev,
  mockConfigureRepository,
  mockSfProjectResolve,
} = vi.hoisted(() => ({
  mockGetMessage: vi.fn(
    (key: string, tokens?: string[]) => `${key}:${tokens?.join(',') ?? ''}`
  ),
  mockParseRev: vi.fn(),
  mockConfigureRepository: vi.fn(),
  mockSfProjectResolve: vi.fn(),
}))

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, stat: vi.fn() }
})
const mockedStat = vi.mocked(stat)

vi.mock('@salesforce/source-deploy-retrieve', () => {
  return {
    getCurrentApiVersion: vi.fn().mockReturnValue({ toString: () => '58.0' }),
    registry: {
      getCurrentApiVersion: vi.fn().mockReturnValue({ toString: () => '58.0' }),
    },
  }
})

vi.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: () => ({
        parseRev: mockParseRev,
        configureRepository: mockConfigureRepository,
      }),
    },
  }
})

vi.mock('@salesforce/core', () => ({
  SfProject: {
    resolve: (...args: unknown[]) => mockSfProjectResolve(...args),
  },
  Logger: {
    childFromRoot: () => ({
      setLevel: vi.fn(),
      shouldLog: () => false,
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    }),
  },
  LoggerLevel: {
    DEBUG: 20,
    ERROR: 50,
    INFO: 30,
    TRACE: 10,
    WARN: 40,
  },
}))

vi.mock('../../../../src/utils/LoggingService')
vi.mock('../../../../src/utils/MessageService', () => {
  return {
    MessageService: vi.fn().mockImplementation(function () {
      return { getMessage: mockGetMessage }
    }),
  }
})
vi.mock('../../../../src/utils/fsUtils')
const mockedPathExists = vi.mocked(pathExists)
const mockedSanitizePath = vi.mocked(sanitizePath)

mockedSanitizePath.mockImplementation(data => data)

describe('Given a ConfigValidator', () => {
  let work: Work
  beforeEach(() => {
    vi.clearAllMocks()
    work = getWork()
    work.config.repo = '.'
    work.config.to = 'test'
    work.config.apiVersion = 46
    mockedPathExists.mockResolvedValue(true as never)
    mockParseRev.mockImplementation(() => Promise.resolve('ref'))
  })

  it('resume nicely when everything is well configured', async () => {
    // Arrange
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: 'notblank',
        from: 'HEAD',
      },
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  it('add errors when repo is not a git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when repo is not git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        repo: 'not/git/folder',
      },
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a git expression', async () => {
    mockParseRev.mockImplementation(() => Promise.reject())
    const emptyString = ''
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-f" is not a git expression', async () => {
    mockParseRev.mockImplementation(() => Promise.reject())
    const emptyString = ''
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        from: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a valid sha pointer', async () => {
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-f" is not a valid sha pointer', async () => {
    mockParseRev.mockImplementationOnce(() => Promise.resolve('ref'))
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" and "-f" are not a valid sha pointer', async () => {
    // Arrange
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        from: notHeadSHA,
        generateDelta: false,
      },
    })

    // Act & Assert
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('do not throw errors when "-t" and "-f" are valid sha pointer', async () => {
    // Arrange
    const notHeadSHA = 'test'

    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  it('do not throw errors when repo contains submodule git file', async () => {
    // Arrange
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        repo: 'submodule/',
      },
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  it('do not throw errors when repo submodule git folder', async () => {
    // Arrange
    const sut = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        repo: 'submodule/',
      },
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  describe('apiVersion parameter handling', () => {
    let latestAPIVersionSupported: number
    beforeAll(() => {
      latestAPIVersionSupported = 58
    })
    beforeEach(() => {
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
    })
    describe('when apiVersion parameter is set with supported value', () => {
      it.each([
        46, 52, 55,
      ])('config.apiVersion (%s) equals the parameter', async version => {
        // Arrange
        work.config.apiVersion = version
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(version)
        expect(work.warnings.length).toEqual(0)
      })
    })
    describe('when apiVersion parameter is set with unsupported value', () => {
      it.each([
        40, 55.1, 0,
      ])(`config.apiVersion (%s) equals the parameter `, async version => {
        // Arrange
        work.config.apiVersion = version
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(version)
        expect(work.warnings.length).toEqual(0)
      })
    })

    describe('when apiVersion parameter is not set', () => {
      describe('when sfdx-project.json file exist', () => {
        const mockSfProject = (sourceApiVersion?: string) => {
          mockSfProjectResolve.mockResolvedValue({
            getSfProjectJson: () => ({
              getContents: () =>
                sourceApiVersion !== undefined ? { sourceApiVersion } : {},
            }),
          })
        }

        describe('when "sourceApiVersion" attribute is set with supported value', () => {
          it.each([
            46, 52, 53, 46.0, 52.0, 55.0,
          ])('config.apiVersion (%s) equals the "sourceApiVersion" attribute', async version => {
            // Arrange
            mockSfProject(String(version))
            work.config.apiVersion = undefined
            const sut = new ConfigValidator(work)

            // Act
            await sut['_handleDefault']()

            // Assert
            expect(work.config.apiVersion).toEqual(+version)
            expect(work.warnings.length).toEqual(0)
          })
        })
        describe('when "sourceApiVersion" attribute is set with invalid value', () => {
          it.each([
            'NaN',
            'awesome',
            '',
          ])('config.apiVersion (%s) defaults to latest version with warning', async version => {
            // Arrange
            mockSfProject(version)
            work.config.apiVersion = undefined
            const sut = new ConfigValidator(work)

            // Act
            await sut['_handleDefault']()

            // Assert
            expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
            expect(work.warnings.length).toEqual(1)
          })
        })

        describe('when "sourceApiVersion" attribute is set with valid low value', () => {
          it('config.apiVersion equals the sourceApiVersion', async () => {
            // Arrange
            mockSfProject('40')
            work.config.apiVersion = undefined
            const sut = new ConfigValidator(work)

            // Act
            await sut['_handleDefault']()

            // Assert
            expect(work.config.apiVersion).toEqual(40)
            expect(work.warnings.length).toEqual(0)
          })
        })

        describe('when "sourceApiVersion" attribute exceeds latest version', () => {
          it('config.apiVersion is overridden to latest with warning', async () => {
            // Arrange
            mockSfProject('1000000000')
            work.config.apiVersion = undefined
            const sut = new ConfigValidator(work)

            // Act
            await sut['_handleDefault']()

            // Assert
            expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
            expect(work.warnings.length).toEqual(1)
          })
        })

        it('when "sourceApiVersion" attribute is not set, defaults to latest with warning', async () => {
          // Arrange
          mockSfProject()
          work.config.apiVersion = undefined
          const sut = new ConfigValidator(work)

          // Act
          await sut['_handleDefault']()

          // Assert
          expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
          expect(work.warnings.length).toEqual(1)
        })
      })
    })
    describe('when sfdx-project.json file does not exist', () => {
      it('config.apiVersion defaults to latest version with warning', async () => {
        // Arrange
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        work.config.apiVersion = undefined
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(work.warnings.length).toEqual(1)
      })
    })

    describe('when apiVersion equals the latest supported version', () => {
      it('When apiVersion equals latestVersion, Then no warning and no override', async () => {
        // Arrange
        work.config.apiVersion = latestAPIVersionSupported
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(work.warnings).toHaveLength(0)
      })
    })

    describe('when apiVersion is explicitly NaN', () => {
      it('When apiVersion is NaN, Then it defaults to latest with defaulted warning', async () => {
        // Arrange
        work.config.apiVersion = NaN
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(work.warnings).toHaveLength(1)
        expect(work.warnings[0].message).toContain(
          'warning.ApiVersionDefaulted'
        )
      })
    })

    describe('when apiVersion exceeds latest supported version', () => {
      it('When apiVersion exceeds latest, Then warning message contains override details', async () => {
        // Arrange
        work.config.apiVersion = 100
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(work.warnings).toHaveLength(1)
        expect(work.warnings[0].message).toContain(
          'warning.ApiVersionOverridden'
        )
      })
    })

    describe('when apiVersion defaults to latest', () => {
      it('When apiVersion is undefined and no project file, Then warning message contains default details', async () => {
        // Arrange
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        work.config.apiVersion = undefined
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.warnings).toHaveLength(1)
        expect(work.warnings[0].message).toContain(
          'warning.ApiVersionDefaulted'
        )
      })
    })

    describe('when apiVersion is set and project file exists', () => {
      it('When apiVersion is defined, Then project file sourceApiVersion is ignored', async () => {
        // Arrange
        mockSfProjectResolve.mockResolvedValue({
          getSfProjectJson: () => ({
            getContents: () => ({ sourceApiVersion: '100' }),
          }),
        })
        work.config.apiVersion = 46
        const sut = new ConfigValidator(work)

        // Act
        await sut['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(46)
        expect(work.warnings).toHaveLength(0)
      })
    })
  })

  describe('error message content', () => {
    it('When repo is not a git repository, Then error contains the path message', async () => {
      // Arrange
      mockedPathExists.mockResolvedValue(false as never)
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          repo: 'not/git/folder',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.PathIsNotGit'),
        })
      )
    })

    it('When git sha is invalid, Then error contains the parameter message', async () => {
      // Arrange
      mockParseRev.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'invalid-sha',
          from: 'HEAD',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ParameterIsNotGitSHA'),
        })
      )
    })
  })

  describe('changesManifest validation', () => {
    beforeEach(() => {
      mockedPathExists.mockResolvedValue(true as never)
      mockParseRev.mockImplementation(() => Promise.resolve('ref'))
    })

    it('Given changesManifest is undefined, When validating, Then stat is not called and no error is added', async () => {
      // Arrange
      const sut = new ConfigValidator({
        ...work,
        config: { ...work.config, to: 'HEAD', from: 'HEAD' },
      })

      // Act
      await sut.validateConfig()

      // Assert
      expect(mockedStat).not.toHaveBeenCalled()
    })

    it('Given the target path does not exist (ENOENT), When validating, Then no error is added', async () => {
      // Arrange
      const notFound = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      mockedStat.mockRejectedValueOnce(notFound)
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'will-be-created.json',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).resolves.not.toThrow()
    })

    it('Given the target path exists as a regular file, When validating, Then no error is added', async () => {
      // Arrange
      mockedStat.mockResolvedValueOnce({
        isFile: () => true,
        isDirectory: () => false,
      } as never)
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'existing.json',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).resolves.not.toThrow()
    })

    it('Given the target path exists as a directory, When validating, Then a ChangesManifestNotAFile error is raised', async () => {
      // Arrange
      mockedStat.mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
      } as never)
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'some-dir',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ChangesManifestNotAFile'),
        })
      )
    })

    it('Given stat fails with a non-ENOENT error, When validating, Then a ChangesManifestStatFailed error is raised', async () => {
      // Arrange
      const eacces = Object.assign(new Error('EACCES'), { code: 'EACCES' })
      mockedStat.mockRejectedValueOnce(eacces)
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'forbidden.json',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ChangesManifestStatFailed'),
        })
      )
    })

    it('Given stat rejects with a non-Error value (e.g. a string), When validating, Then the code guard short-circuits to undefined and a ChangesManifestStatFailed error is raised', async () => {
      // Arrange — `unknown`-discipline coverage: our narrowing must gracefully
      // handle a promise rejection where the thrown value is not an Error
      // instance (exotic Node/userland throws, polyfill quirks).
      mockedStat.mockRejectedValueOnce('not-an-error' as unknown as Error)
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'weird.json',
        },
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ChangesManifestStatFailed'),
        })
      )
    })
  })
})
