import { SDRMetadataAdapter } from '../../../../src/metadata/sdrMetadataAdapter'
import type { Work } from '../../../../src/types/work'
import ConfigValidator from '../../../../src/utils/configValidator'
import { pathExists, sanitizePath } from '../../../../src/utils/fsUtils'
import { getWork } from '../../../__utils__/testWork'

const mockParseRev = jest.fn()
const mockConfigureRepository = jest.fn()

jest.mock('@salesforce/source-deploy-retrieve', () => {
  return {
    getCurrentApiVersion: jest.fn().mockReturnValue({ toString: () => '58.0' }),
    registry: {
      getCurrentApiVersion: jest
        .fn()
        .mockReturnValue({ toString: () => '58.0' }),
    },
  }
})

jest.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: () => ({
        parseRev: mockParseRev,
        configureRepository: mockConfigureRepository,
      }),
    },
  }
})

const mockSfProjectResolve = jest.fn()
jest.mock('@salesforce/core', () => ({
  SfProject: {
    resolve: (...args: unknown[]) => mockSfProjectResolve(...args),
  },
  Logger: {
    childFromRoot: () => ({
      setLevel: jest.fn(),
      shouldLog: () => false,
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
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

jest.mock('../../../../src/utils/MessageService')
jest.mock('../../../../src/utils/fsUtils')
const mockedPathExists = jest.mocked(pathExists)
const mockedSanitizePath = jest.mocked(sanitizePath)

mockedSanitizePath.mockImplementation(data => data)

describe(`test if the application`, () => {
  let work: Work
  beforeEach(() => {
    work = getWork()
    work.config.repo = '.'
    work.config.to = 'test'
    work.config.apiVersion = 46
    mockedPathExists.mockResolvedValue(true as never)
    mockParseRev.mockImplementation(() => Promise.resolve('ref'))
  })

  it('resume nicely when everything is well configured', async () => {
    // Arrange
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: 'notblank',
        from: 'HEAD',
      },
    })

    // Act & Assert
    await expect(configValidator.validateConfig()).resolves.not.toThrow()
  })

  it('add errors when repo is not a git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: '',
      },
    })
    expect.assertions(1)
    await expect(configValidator.validateConfig()).rejects.toThrow()
  })

  it('throws errors when repo is not git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        repo: 'not/git/folder',
      },
    })
    expect.assertions(1)
    await expect(configValidator.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a git expression', async () => {
    mockParseRev.mockImplementation(() => Promise.reject())
    const emptyString = ''
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(configValidator.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-f" is not a git expression', async () => {
    mockParseRev.mockImplementation(() => Promise.reject())
    const emptyString = ''
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        from: emptyString,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(configValidator.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a valid sha pointer', async () => {
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(configValidator.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-f" is not a valid sha pointer', async () => {
    mockParseRev.mockImplementationOnce(() => Promise.resolve('ref'))
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })
    expect.assertions(1)
    await expect(configValidator.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" and "-f" are not a valid sha pointer', async () => {
    expect.assertions(1)
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    mockParseRev.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        to: notHeadSHA,
        from: notHeadSHA,
        generateDelta: false,
      },
    })

    try {
      await configValidator.validateConfig()
    } catch (err) {
      expect(err).toBeDefined()
    }
  })

  it('do not throw errors when "-t" and "-f" are valid sha pointer', async () => {
    // Arrange
    const notHeadSHA = 'test'

    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        from: notHeadSHA,
        generateDelta: false,
      },
    })

    // Act & Assert
    await expect(configValidator.validateConfig()).resolves.not.toThrow()
  })

  it('do not throw errors when repo contains submodule git file', async () => {
    expect.assertions(1)
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        repo: 'submodule/',
      },
    })
    await expect(configValidator.validateConfig()).resolves.not.toBe({})
  })

  it('do not throw errors when repo submodule git folder', async () => {
    expect.assertions(1)
    const configValidator = new ConfigValidator({
      ...work,
      config: {
        ...work.config,
        repo: 'submodule/',
      },
    })
    await expect(configValidator.validateConfig()).resolves.not.toBe({})
  })

  describe('apiVersion parameter handling', () => {
    let latestAPIVersionSupported: number
    beforeAll(() => {
      latestAPIVersionSupported = 58
    })
    beforeEach(() => {
      jest.resetAllMocks()
      jest
        .spyOn(SDRMetadataAdapter, 'getLatestApiVersion')
        .mockResolvedValue('58')
    })
    describe('when apiVersion parameter is set with supported value', () => {
      it.each([
        46, 52, 55,
      ])('config.apiVersion (%s) equals the parameter', async version => {
        // Arrange
        work.config.apiVersion = version
        const configValidator = new ConfigValidator(work)

        // Act
        await configValidator['_handleDefault']()

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
        const configValidator = new ConfigValidator(work)

        // Act
        await configValidator['_handleDefault']()

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
            const configValidator = new ConfigValidator(work)

            // Act
            await configValidator['_handleDefault']()

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
            const configValidator = new ConfigValidator(work)

            // Act
            await configValidator['_handleDefault']()

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
            const configValidator = new ConfigValidator(work)

            // Act
            await configValidator['_handleDefault']()

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
            const configValidator = new ConfigValidator(work)

            // Act
            await configValidator['_handleDefault']()

            // Assert
            expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
            expect(work.warnings.length).toEqual(1)
          })
        })

        it('when "sourceApiVersion" attribute is not set, defaults to latest with warning', async () => {
          // Arrange
          mockSfProject()
          work.config.apiVersion = undefined
          const configValidator = new ConfigValidator(work)

          // Act
          await configValidator['_handleDefault']()

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
        const configValidator = new ConfigValidator(work)

        // Act
        await configValidator['_handleDefault']()

        // Assert
        expect(work.config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(work.warnings.length).toEqual(1)
      })
    })
  })
})
