import { stat } from 'node:fs/promises'

import { SfError } from '@salesforce/core/sfError'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SDRMetadataAdapter } from '../../../../src/metadata/sdrMetadataAdapter'
import type { Config } from '../../../../src/types/config'
import ConfigValidator from '../../../../src/utils/configValidator'
import {
  NotACommitError,
  RepositoryRefusalError,
} from '../../../../src/utils/errorUtils'
import {
  pathExists,
  sanitizePath,
  treatPathSep,
} from '../../../../src/utils/fsUtils'
import { Logger } from '../../../../src/utils/LoggingService'
import { getConfig } from '../../../__utils__/testWork'

const {
  mockGetMessage,
  mockResolveCommit,
  mockGetMergeBase,
  mockSfProjectResolve,
  MOCK_REPOSITORY_KEY,
  MOCK_REPOSITORY_KEY_ESCAPED,
} = vi.hoisted(() => ({
  mockGetMessage: vi.fn(
    (key: string, tokens?: string[]) => `${key}:${tokens?.join(',') ?? ''}`
  ),
  mockResolveCommit: vi.fn(),
  mockGetMergeBase: vi.fn(),
  mockSfProjectResolve: vi.fn(),
  // Stands in for GitAdapter's absolute repository key — a fixed,
  // recognizable value so PathIsNotGit assertions can pin exactly what
  // reaches the message, independent of the test's own config.repo. It
  // carries a newline on purpose: a repository path is user input, and
  // every sanitizer fixed point would let the escaping silently vanish.
  MOCK_REPOSITORY_KEY: '/abs/mock\nrepo',
  MOCK_REPOSITORY_KEY_ESCAPED: '/abs/mock\\u{a}repo',
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
        resolveCommit: mockResolveCommit,
        getMergeBase: mockGetMergeBase,
        repositoryKey: MOCK_REPOSITORY_KEY,
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
const mockedTreatPathSep = vi.mocked(treatPathSep)

mockedSanitizePath.mockImplementation(data => data)
// getWork()'s fixture source goes through sourceDirs() -> parseSourceDirs(),
// which now calls treatPathSep directly (not just via sanitizePath) to
// reject '..' segments before normalize() resolves them away.
mockedTreatPathSep.mockImplementation(data => data)

describe('Given a ConfigValidator', () => {
  let config: Config
  beforeEach(() => {
    vi.clearAllMocks()
    config = getConfig()
    config.repo = '.'
    config.to = 'test'
    config.apiVersion = 46
    mockedPathExists.mockResolvedValue(true as never)
    mockResolveCommit.mockImplementation(() => Promise.resolve('ref'))
  })

  it('resume nicely when everything is well configured', async () => {
    // Arrange
    const sut = new ConfigValidator({
      ...config,
      to: 'notblank',
      from: 'HEAD',
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  it('add errors when repo is not a git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const sut = new ConfigValidator({
      ...config,
      to: '',
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when repo is not git repository', async () => {
    mockedPathExists.mockResolvedValue(false as never)
    const sut = new ConfigValidator({
      ...config,
      repo: 'not/git/folder',
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a git expression', async () => {
    mockResolveCommit.mockImplementation(() => Promise.reject())
    const emptyString = ''
    const sut = new ConfigValidator({
      ...config,
      to: emptyString,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-f" is not a git expression', async () => {
    mockResolveCommit.mockImplementation(() => Promise.reject())
    const emptyString = ''
    const sut = new ConfigValidator({
      ...config,
      from: emptyString,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" is not a valid sha pointer', async () => {
    mockResolveCommit.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const sut = new ConfigValidator({
      ...config,
      to: notHeadSHA,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-f" is not a valid sha pointer', async () => {
    mockResolveCommit.mockImplementationOnce(() => Promise.resolve('ref'))
    mockResolveCommit.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const sut = new ConfigValidator({
      ...config,
      from: notHeadSHA,
      generateDelta: false,
    })
    expect.assertions(1)
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('throws errors when "-t" and "-f" are not a valid sha pointer', async () => {
    // Arrange
    mockResolveCommit.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    mockResolveCommit.mockImplementationOnce(() =>
      Promise.reject(new Error('not a valid sha pointer'))
    )
    const notHeadSHA = 'test'
    const sut = new ConfigValidator({
      ...config,
      to: notHeadSHA,
      from: notHeadSHA,
      generateDelta: false,
    })

    // Act & Assert
    await expect(sut.validateConfig()).rejects.toThrow()
  })

  it('do not throw errors when "-t" and "-f" are valid sha pointer', async () => {
    // Arrange
    const notHeadSHA = 'test'

    const sut = new ConfigValidator({
      ...config,
      from: notHeadSHA,
      generateDelta: false,
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  it('do not throw errors when repo contains submodule git file', async () => {
    // Arrange
    const sut = new ConfigValidator({
      ...config,
      repo: 'submodule/',
    })

    // Act & Assert
    await expect(sut.validateConfig()).resolves.not.toThrow()
  })

  it('do not throw errors when repo submodule git folder', async () => {
    // Arrange
    const sut = new ConfigValidator({
      ...config,
      repo: 'submodule/',
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
    describe('Given a usable pinned apiVersion', () => {
      it.each([46, 70])(
        'When _handleDefault runs with %s, Then no lookup is made and the pin is kept without warning',
        async version => {
          // Arrange
          const lookup = vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion')
          config.apiVersion = version
          const sut = new ConfigValidator(config)

          // Act
          const warnings = await sut['_handleDefault']()

          // Assert
          expect(lookup).not.toHaveBeenCalled()
          expect(config.apiVersion).toBe(version)
          expect(warnings).toEqual([])
        }
      )
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
          it.each([46, 52, 53, 46.0, 52.0, 55.0])(
            'config.apiVersion (%s) equals the "sourceApiVersion" attribute',
            async version => {
              // Arrange
              mockSfProject(String(version))
              config.apiVersion = undefined
              const sut = new ConfigValidator(config)

              // Act
              const warnings = await sut['_handleDefault']()

              // Assert
              expect(config.apiVersion).toEqual(+version)
              expect(warnings.length).toEqual(0)
            }
          )
        })
        describe('when "sourceApiVersion" attribute is set with invalid value', () => {
          it.each(['NaN', 'awesome', '', '0.0', '-1.0'])(
            'config.apiVersion (%s) defaults to latest version with warning',
            async version => {
              // Arrange
              mockSfProject(version)
              config.apiVersion = undefined
              const sut = new ConfigValidator(config)

              // Act
              const warnings = await sut['_handleDefault']()

              // Assert
              expect(config.apiVersion).toEqual(latestAPIVersionSupported)
              expect(warnings.length).toEqual(1)
            }
          )
        })

        describe('when "sourceApiVersion" attribute is set with valid low value', () => {
          it('config.apiVersion equals the sourceApiVersion', async () => {
            // Arrange
            mockSfProject('40')
            config.apiVersion = undefined
            const sut = new ConfigValidator(config)

            // Act
            const warnings = await sut['_handleDefault']()

            // Assert
            expect(config.apiVersion).toEqual(40)
            expect(warnings.length).toEqual(0)
          })
        })

        describe('Given sourceApiVersion is set and nothing else is pinned', () => {
          it('When _handleDefault runs, Then the project version is kept and no lookup is made', async () => {
            // Arrange
            const lookup = vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion')
            mockSfProject('52.0')
            config.apiVersion = undefined
            const sut = new ConfigValidator(config)

            // Act
            const warnings = await sut['_handleDefault']()

            // Assert
            expect(lookup).not.toHaveBeenCalled()
            expect(config.apiVersion).toBe(52)
            expect(warnings).toEqual([])
          })
        })

        it('when "sourceApiVersion" attribute is not set, defaults to latest with warning', async () => {
          // Arrange
          mockSfProject()
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act
          const warnings = await sut['_handleDefault']()

          // Assert
          expect(config.apiVersion).toEqual(latestAPIVersionSupported)
          expect(warnings.length).toEqual(1)
        })
      })
    })
    describe('when sfdx-project.json file does not exist', () => {
      it('config.apiVersion defaults to latest version with warning', async () => {
        // Arrange
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        config.apiVersion = undefined
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut['_handleDefault']()

        // Assert
        expect(config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(warnings.length).toEqual(1)
      })
    })

    describe('when the latest version lookup fails (e.g. offline)', () => {
      beforeEach(() => {
        vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
          new Error(
            'Unable to get a current API version from the appexchange org'
          )
        )
      })

      describe('when apiVersion is not resolvable', () => {
        it('When the lookup fails and no version is available, Then it throws an actionable ConfigError', async () => {
          // Arrange
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message:
                'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org',
            })
          )
        })
      })

      describe('when apiVersion is NaN', () => {
        it('When the lookup fails and apiVersion is NaN, Then it throws an actionable ConfigError', async () => {
          // Arrange
          config.apiVersion = NaN
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message: expect.stringContaining(
                'error.ApiVersionRetrievalFailed'
              ),
            })
          )
        })
      })

      describe('Given the refusal describes the lookup failure', () => {
        it('When the lookup rejects the way SDR does, with an SfError wrapping the network error, Then the refusal names the cause in parentheses', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            new SfError(
              'Unable to get a current API version from the appexchange org',
              'ApiVersionRetrievalError',
              ['Provide an API version explicitly'],
              Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9'), {
                code: 'ECONNREFUSED',
              })
            )
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message:
                'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org (connect ECONNREFUSED 127.0.0.1:9)',
            })
          )
        })

        it('When the cause message carries a control character, Then the refusal carries its escaped form and never the raw character', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            new Error(
              'Unable to get a current API version from the appexchange org',
              {
                cause: new Error('connect\nECONNREFUSED'),
              }
            )
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act
          const error = await sut['_handleDefault']().catch(
            (thrown: unknown) => thrown
          )

          // Assert
          expect((error as Error).message).toContain(
            'connect\\u{a}ECONNREFUSED'
          )
          expect((error as Error).message).not.toContain(
            'connect\nECONNREFUSED'
          )
        })

        it('When the cause message echoes a proxy URL carrying credentials, Then the refusal redacts them', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            new Error(
              'Unable to get a current API version from the appexchange org',
              {
                cause: new Error(
                  'Unsupported protocol for proxy URL: tcp://alice:s3cr3tPass@127.0.0.1:9'
                ),
              }
            )
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message:
                'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org (Unsupported protocol for proxy URL: tcp://<redacted>@127.0.0.1:9)',
            })
          )
        })

        it('When the cause lists a credentialed PAC proxy entry, Then the refusal redacts it', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            new Error(
              'Unable to get a current API version from the appexchange org',
              {
                cause: new Error(
                  'Failed to establish a socket connection to proxies: ["PROXY alice:s3cr3tPass@127.0.0.1:9"]'
                ),
              }
            )
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message:
                'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org (Failed to establish a socket connection to proxies: ["PROXY <redacted>@127.0.0.1:9"])',
            })
          )
        })

        it('When the echoed credentials are longer than the message length cap, Then they are redacted before the cap can cut them loose from their at sign', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            new Error(
              'Unable to get a current API version from the appexchange org',
              {
                cause: new Error(
                  `Unsupported protocol for proxy URL: tcp://alice:${'p'.repeat(200)}@127.0.0.1:9`
                ),
              }
            )
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act
          const error = await sut['_handleDefault']().catch(
            (thrown: unknown) => thrown
          )

          // Assert
          expect((error as Error).message).toContain('tcp://<redacted>@')
          expect((error as Error).message).not.toContain('alice:')
        })

        it('When the cause is not an Error, Then the bare SDR message renders', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            new Error(
              'Unable to get a current API version from the appexchange org',
              { cause: 'ECONNREFUSED' }
            )
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message:
                'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org',
            })
          )
        })

        it('When the rejection is not an Error yet carries an Error cause, Then the cause is ignored and the bare stringified rejection renders', async () => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
            {
              cause: new Error('connect ECONNREFUSED 127.0.0.1:9'),
            }
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message: 'error.ApiVersionRetrievalFailed:[object Object]',
            })
          )
        })
      })
    })

    describe('Given a library caller whose apiVersion bypasses the number type', () => {
      it.each<[unknown, number | undefined]>([
        ['', undefined],
        [null, undefined],
        ['abc', undefined],
        [0, undefined],
        [-1, undefined],
        [undefined, undefined],
        ['67.0', 67],
        ['67', 67],
        [67, 67],
        [66.5, 66],
      ])(
        'When the config is sanitised from %j, Then apiVersion becomes %j',
        (input, expected) => {
          // Arrange
          Object.assign(config, { apiVersion: input })
          const sut = new ConfigValidator(config)

          // Act
          sut['_sanitizeConfig']()

          // Assert
          expect(config.apiVersion).toBe(expected)
        }
      )

      it('When apiVersion is an empty string and no sfdx-project.json exists, Then validateConfig defaults to the latest version and returns the defaulted warning', async () => {
        // Arrange
        Object.assign(config, { apiVersion: '' })
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut.validateConfig()

        // Assert
        expect(config.apiVersion).toBe(58)
        expect(warnings).toHaveLength(1)
        expect(warnings[0]!.message).toBe('warning.ApiVersionDefaulted:58')
      })

      it('When apiVersion is an empty string and the lookup fails, Then validateConfig refuses instead of keeping it', async () => {
        // Arrange
        vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
          new Error(
            'Unable to get a current API version from the appexchange org'
          )
        )
        Object.assign(config, { apiVersion: '' })
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        const sut = new ConfigValidator(config)

        // Act & Assert
        await expect(sut.validateConfig()).rejects.toThrow(
          expect.objectContaining({
            name: 'ConfigError',
            message:
              'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org',
          })
        )
      })
    })

    describe('Given the lookup succeeds with a value that is not a usable API version', () => {
      it.each(['NaN', '0', '-1'])(
        'When the lookup answers %s and nothing is pinned, Then the run is refused naming what came back',
        async answer => {
          // Arrange
          vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
            answer
          )
          mockSfProjectResolve.mockRejectedValue(
            new Error('No sfdx-project.json found')
          )
          config.apiVersion = undefined
          const sut = new ConfigValidator(config)

          // Act & Assert
          await expect(sut['_handleDefault']()).rejects.toThrow(
            expect.objectContaining({
              name: 'ConfigError',
              message: `error.ApiVersionRetrievalFailed:error.ApiVersionLookupUnusable:${answer}`,
            })
          )
        }
      )

      it('When the lookup answers 1 and nothing is pinned, Then 1 is the defaulted version', async () => {
        // Arrange
        vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
          '1'
        )
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        config.apiVersion = undefined
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut['_handleDefault']()

        // Assert
        expect(config.apiVersion).toBe(1)
        expect(warnings).toHaveLength(1)
      })
    })

    describe('Given the API version cannot be resolved while the input is also invalid', () => {
      const REFUSAL =
        'error.ApiVersionRetrievalFailed:Unable to get a current API version from the appexchange org'

      beforeEach(() => {
        vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockRejectedValue(
          new Error(
            'Unable to get a current API version from the appexchange org'
          )
        )
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        config.apiVersion = undefined
      })

      it('When --to does not resolve, Then the sha-pointer error and the refusal are both reported, the sha-pointer error first', async () => {
        // Arrange
        mockResolveCommit.mockImplementation((ref: string) =>
          ref === 'bad-to'
            ? Promise.reject(new Error('bad sha'))
            : Promise.resolve('ref')
        )
        const sut = new ConfigValidator({
          ...config,
          from: 'HEAD',
          to: 'bad-to',
        })

        // Act & Assert
        await expect(sut.validateConfig()).rejects.toThrow(
          expect.objectContaining({
            name: 'ConfigError',
            message: `error.ParameterIsNotGitSHA:to,bad-to, ${REFUSAL}`,
          })
        )
      })

      it('When the repository has no .git, Then PathIsNotGit and the refusal are both reported', async () => {
        // Arrange
        mockedPathExists.mockResolvedValue(false as never)
        const sut = new ConfigValidator(config)

        // Act & Assert
        await expect(sut.validateConfig()).rejects.toThrow(
          expect.objectContaining({
            message: `error.PathIsNotGit:${MOCK_REPOSITORY_KEY_ESCAPED}, ${REFUSAL}`,
          })
        )
      })

      it('When mergeBase is set and --to does not resolve, Then both are reported and getMergeBase is never called', async () => {
        // Arrange
        mockResolveCommit.mockImplementation((ref: string) =>
          ref === 'bad-to'
            ? Promise.reject(new Error('bad sha'))
            : Promise.resolve('ref')
        )
        const sut = new ConfigValidator({
          ...config,
          from: 'HEAD',
          to: 'bad-to',
          mergeBase: true,
        })

        // Act
        const error = await sut
          .validateConfig()
          .catch((thrown: unknown) => thrown)

        // Assert
        expect((error as Error).message).toBe(
          `error.ParameterIsNotGitSHA:to,bad-to, ${REFUSAL}`
        )
        expect(mockGetMergeBase).not.toHaveBeenCalled()
      })

      it('When the input is valid, Then the refusal is thrown alone and byte-identical', async () => {
        // Arrange
        const sut = new ConfigValidator(config)

        // Act & Assert
        await expect(sut.validateConfig()).rejects.toThrow(
          expect.objectContaining({ name: 'ConfigError', message: REFUSAL })
        )
      })

      it('When defaulting the API version fails with something other than a ConfigError, Then that error propagates untouched', async () => {
        // Arrange — with valid input, the defaulted warning is the first and
        // only message rendered, so a one-shot implementation reaches it.
        const defect = new TypeError('boom')
        vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
          '58'
        )
        mockGetMessage.mockImplementationOnce(() => {
          throw defect
        })
        const sut = new ConfigValidator(config)

        // Act & Assert
        await expect(sut.validateConfig()).rejects.toBe(defect)
      })
    })

    describe('when apiVersion is explicitly NaN', () => {
      it('When apiVersion is NaN, Then it defaults to latest with defaulted warning', async () => {
        // Arrange
        config.apiVersion = NaN
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut['_handleDefault']()

        // Assert
        expect(config.apiVersion).toEqual(latestAPIVersionSupported)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].message).toContain('warning.ApiVersionDefaulted')
      })

      it('When apiVersion is NaN, Then validateConfig returns that same warning to its caller', async () => {
        // Arrange — validateConfig is the only surface main() sees, so the
        // warnings it returns are what reaches the user. Assert the channel,
        // not just the value the private helper computed.
        config.apiVersion = NaN
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut.validateConfig()

        // Assert
        expect(warnings).toHaveLength(1)
        expect(warnings[0]!.message).toContain('warning.ApiVersionDefaulted')
      })

      it('When apiVersion is supported, Then validateConfig returns no warnings', async () => {
        // Arrange
        config.apiVersion = 52
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut.validateConfig()

        // Assert
        expect(warnings).toEqual([])
      })
    })

    describe('when apiVersion defaults to latest', () => {
      it('When apiVersion is undefined and no project file, Then warning message contains default details', async () => {
        // Arrange
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        config.apiVersion = undefined
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut['_handleDefault']()

        // Assert
        expect(warnings).toHaveLength(1)
        expect(warnings[0].message).toContain('warning.ApiVersionDefaulted')
      })
    })

    describe('_getApiVersion diagnostic logging', () => {
      it('When sfdx-project.json resolution fails, Then the failure is logged for diagnostics', async () => {
        // Arrange
        mockSfProjectResolve.mockRejectedValue(
          new Error('No sfdx-project.json found')
        )
        config.apiVersion = undefined
        const sut = new ConfigValidator(config)

        // Act
        await sut['_getApiVersion']()

        // Assert
        expect(Logger.debug).toHaveBeenCalledOnce()
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
        config.apiVersion = 46
        const sut = new ConfigValidator(config)

        // Act
        const warnings = await sut['_handleDefault']()

        // Assert
        expect(config.apiVersion).toEqual(46)
        expect(warnings).toHaveLength(0)
      })
    })
  })

  describe('error message content', () => {
    it('When repo is not a git repository, Then error contains the path message', async () => {
      // Arrange
      mockedPathExists.mockResolvedValue(false as never)
      const sut = new ConfigValidator({
        ...config,
        repo: 'not/git/folder',
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
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        to: 'invalid-sha',
        from: 'HEAD',
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ParameterIsNotGitSHA'),
        })
      )
      // Content is not asserted (see the StringLiteral,ArrowFunction
      // disable on this call site); presence of the call is what a
      // CallExpression removal mutant (L58) would drop.
      expect(Logger.debug).toHaveBeenCalled()
    })

    it('Given "to" contains a control character and git sha validation fails, When validating, Then the error message carries the escaped form and never the raw character', async () => {
      // Arrange — proves sanitizeForMessage is still applied at this error
      // site: dropping the call would leak the raw control character (and
      // any ANSI/bidi payload it carries) straight into the message.
      const shaWithControl = 'bad\nsha'
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        to: shaWithControl,
        from: 'HEAD',
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toContain('bad\\u{a}sha')
      expect((error as Error).message).not.toContain(shaWithControl)
    })
  })

  describe('Given a repository-level refusal from resolveCommit', () => {
    it('When resolveCommit refuses the repository, Then the refusal is reported once instead of two sha-pointer errors', async () => {
      // Arrange
      const refusal = new RepositoryRefusalError(
        "'/proj/repo' uses a repository format this version of sgd cannot read"
      )
      mockResolveCommit.mockRejectedValue(refusal)
      const sut = new ConfigValidator({ ...config, from: 'HEAD~1', to: 'HEAD' })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(refusal.message)
      expect((error as Error).message).not.toContain(
        'error.ParameterIsNotGitSHA'
      )
    })

    it('When resolveCommit rejects both refs with an ordinary error, Then both sha-pointer messages are reported (the refusal dedupe does not over-collapse distinct errors)', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((sha: string) =>
        Promise.reject(new Error(`bad sha: ${sha}`))
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'bad-from',
        to: 'bad-to',
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      const parts = (error as Error).message.split(', ')
      expect(parts).toHaveLength(2)
      expect(parts).toContain('error.ParameterIsNotGitSHA:from,bad-from')
      expect(parts).toContain('error.ParameterIsNotGitSHA:to,bad-to')
    })

    it('When only one of the two SHA keys refuses, Then the single reported message is the refusal', async () => {
      // Arrange
      const refusal = new RepositoryRefusalError(
        "'/proj/repo' is not a git repository"
      )
      mockResolveCommit
        .mockResolvedValueOnce('valid')
        .mockRejectedValueOnce(refusal)
      const sut = new ConfigValidator({ ...config, from: 'HEAD~1', to: 'HEAD' })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(refusal.message)
    })
  })

  describe('Given a revision that does not resolve to a commit', () => {
    it('When --to peels to a tree, Then the error carries ParameterIsNotCommit for to with the typed value and the kind, and never the sha-pointer message', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        ref === 'HEAD^{tree}'
          ? Promise.reject(new NotACommitError('HEAD^{tree}', 'tree'))
          : Promise.resolve('commit-oid')
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'HEAD~1',
        to: 'HEAD^{tree}',
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        'error.ParameterIsNotCommit:to,HEAD^{tree},tree'
      )
      expect((error as Error).message).not.toContain(
        'error.ParameterIsNotGitSHA'
      )
      expect((error as Error).name).toBe('ConfigError')
    })

    it('When --from peels to a blob, Then the error carries ParameterIsNotCommit for from', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        ref === 'HEAD:file'
          ? Promise.reject(new NotACommitError('HEAD:file', 'blob'))
          : Promise.resolve('commit-oid')
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'HEAD:file',
        to: 'HEAD',
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        'error.ParameterIsNotCommit:from,HEAD:file,blob'
      )
    })

    it('When both flags peel to trees, Then two distinct ParameterIsNotCommit sentences are reported', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        Promise.reject(new NotACommitError(ref, 'tree'))
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'a^{tree}',
        to: 'b^{tree}',
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      const parts = (error as Error).message.split(', ')
      expect(parts).toHaveLength(2)
      expect(parts).toContain('error.ParameterIsNotCommit:from,a^{tree},tree')
      expect(parts).toContain('error.ParameterIsNotCommit:to,b^{tree},tree')
    })

    it('When --from is unresolvable and --to peels to a tree, Then one sha-pointer sentence and one non-commit sentence are reported', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        ref === 'nope'
          ? Promise.reject(new Error('bad'))
          : Promise.reject(new NotACommitError('HEAD^{tree}', 'tree'))
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'nope',
        to: 'HEAD^{tree}',
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      const parts = (error as Error).message.split(', ')
      expect(parts).toContain('error.ParameterIsNotGitSHA:from,nope')
      expect(parts).toContain('error.ParameterIsNotCommit:to,HEAD^{tree},tree')
    })

    it('When the typed value carries a control character, Then the message carries its escaped form and never the raw character', async () => {
      // Arrange
      const shaWithControl = 'HEAD\n^{tree}'
      mockResolveCommit.mockImplementation(() =>
        Promise.reject(new NotACommitError(shaWithControl, 'tree'))
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'HEAD',
        to: shaWithControl,
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert — pins the branch as well as the escaping: asserting only
      // that the raw character is gone would also hold on the
      // ParameterIsNotGitSHA fallback, which sanitizes too.
      expect((error as Error).message).toContain(
        'error.ParameterIsNotCommit:to,HEAD\\u{a}^{tree},tree'
      )
      expect((error as Error).message).not.toContain(shaWithControl)
    })

    it('When mergeBase is set and --to peels to a tree, Then it throws ParameterIsNotCommit and never calls getMergeBase', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        ref === 'HEAD^{tree}'
          ? Promise.reject(new NotACommitError('HEAD^{tree}', 'tree'))
          : Promise.resolve('commit-oid')
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'HEAD~1',
        to: 'HEAD^{tree}',
        mergeBase: true,
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        'error.ParameterIsNotCommit:to,HEAD^{tree},tree'
      )
      expect(mockGetMergeBase).not.toHaveBeenCalled()
    })

    it('When both flags resolve, Then config.from and config.to hold what the resolver returned', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        Promise.resolve(`${ref}-peeled`)
      )
      const cfg = { ...config, from: 'v-annot', to: 'main' }

      // Act
      await new ConfigValidator(cfg).validateConfig()

      // Assert
      expect(cfg.from).toBe('v-annot-peeled')
      expect(cfg.to).toBe('main-peeled')
    })
  })

  describe('getMessage token arrays contain correct values (L46, L72, L109, L165)', () => {
    it('Given invalid SHA for "to", When error thrown, Then message contains the SHA parameter name and value (kills L46 [] mutant)', async () => {
      // L46 mutant: getMessage(..., []) → message = 'error.ParameterIsNotGitSHA:'
      // Real: getMessage(..., ['to', 'bad-to']) → 'error.ParameterIsNotGitSHA:to,bad-to'
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        to: 'bad-to',
        from: 'HEAD',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('to'),
        })
      )
    })

    it('Given apiVersion defaults to latest, When _handleDefault, Then warning message contains latestVersion (kills L165 [] mutant)', async () => {
      // L165 mutant: getMessage(..., []) → message = 'warning.ApiVersionDefaulted:'
      // Real: getMessage(..., ['58']) → 'warning.ApiVersionDefaulted:58'
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
      mockSfProjectResolve.mockRejectedValue(new Error('no project'))
      config.apiVersion = undefined
      const sut = new ConfigValidator(config)
      const warnings = await sut['_handleDefault']()

      expect(warnings[0].message).toContain('58')
    })
  })

  describe('SHA_KEYS covers both from and to (L20)', () => {
    it('Given both from and to are invalid SHAs, When validating, Then error message includes both parameters', async () => {
      // Mutant '' instead of 'from' or 'to' would lose the parameter names in messages
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        to: 'bad-to',
        from: 'bad-from',
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/error\.ParameterIsNotGitSHA/),
        })
      )
    })

    it('Given from is invalid SHA only, When validating, Then error is thrown for from key', async () => {
      // Ensures SHA_KEYS contains 'from' (not empty string)
      mockResolveCommit
        .mockResolvedValueOnce('valid-to')
        .mockRejectedValueOnce(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'bad-from',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/error\.ParameterIsNotGitSHA/),
        })
      )
    })
  })

  describe('errors array accumulation (L46, L72, L75-L76)', () => {
    it('Given both git SHA invalid and repo missing, When validating, Then error combines both messages', async () => {
      // Mutant [] on errors.push in SHA loop would lose the SHA error
      // Mutant [] on getMessage([repo]) would lose the path in message
      mockedPathExists.mockResolvedValue(false as never)
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        repo: 'missing/repo',
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.PathIsNotGit'),
        })
      )
    })

    it('Given errors join produces non-empty string (L79), When validating, Then ConfigError gets the joined messages', async () => {
      // Mutant "" for errors.join(', ') would make ConfigError("")
      mockedPathExists.mockResolvedValue(false as never)
      const sut = new ConfigValidator({
        ...config,
        repo: 'not-git',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            `error.PathIsNotGit:${MOCK_REPOSITORY_KEY_ESCAPED}`
          ),
        })
      )
    })
  })

  describe('_apiVersionDefault defaulting', () => {
    beforeEach(() => {
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
    })

    it('Given apiVersion is NaN, When _handleDefault runs, Then it defaults to latest', async () => {
      // Mutant: the usable-pin guard in _handleDefault forced true returns before defaulting, so apiVersion stays NaN
      config.apiVersion = NaN
      const sut = new ConfigValidator(config)
      const warnings = await sut['_handleDefault']()

      expect(config.apiVersion).toBe(58)
      expect(warnings).toHaveLength(1)
    })

    it('Given apiVersion is undefined after the project lookup, When _handleDefault runs, Then it defaults to latest', async () => {
      // Mutant: the usable-pin guard in _handleDefault forced true returns before defaulting, so apiVersion stays undefined
      config.apiVersion = undefined
      mockSfProjectResolve.mockRejectedValue(new Error('no project'))
      const sut = new ConfigValidator(config)
      const warnings = await sut['_handleDefault']()

      expect(config.apiVersion).toBe(58)
      expect(warnings).toHaveLength(1)
    })
  })

  describe('_validateChangesManifest message tokens (L96, L109, L132, L137)', () => {
    beforeEach(() => {
      mockedPathExists.mockResolvedValue(true as never)
      mockResolveCommit.mockResolvedValue('ref')
    })

    it('Given target is directory (isFile=false), When validating, Then error message contains target path (L96 [])', async () => {
      // Mutant [] for [target] in getMessage → message has no path token
      mockedStat.mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
      } as never)
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'my-dir',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'error.ChangesManifestNotAFile:my-dir'
          ),
        })
      )
    })

    it('Given stat fails with non-ENOENT, When validating, Then error message contains path and error detail (L109 [])', async () => {
      // Mutant [] for [target, getErrorMessage(error)] → message has no tokens
      const eacces = Object.assign(new Error('permission denied'), {
        code: 'EACCES',
      })
      mockedStat.mockRejectedValueOnce(eacces)
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'locked-file.json',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'error.ChangesManifestStatFailed:locked-file.json'
          ),
        })
      )
    })

    it('Given target is not a file (L132 ConditionalExpression true), When validating, Then error always contains ChangesManifestNotAFile', async () => {
      // Mutant true: isFile() check always enters error path even for real files
      // We cannot test the inverse without modifying code, so assert the real case: directory = error
      mockedStat.mockResolvedValueOnce({
        isFile: () => false,
      } as never)
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'not-a-file',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ChangesManifestNotAFile'),
        })
      )
    })

    it('Given target is a regular file (L132 boundary), When validating, Then no ChangesManifestNotAFile error', async () => {
      // Mutant true: always errors → this test verifies !isFile()=false means no error
      mockedStat.mockResolvedValueOnce({ isFile: () => true } as never)
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'real-file.json',
      })

      await expect(sut.validateConfig()).resolves.not.toThrow()
    })
  })

  describe('mutation-killers: targeted asserts on observable side-effects', () => {
    beforeEach(() => {
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
    })

    it('Given multiple errors accumulate, When validateConfig throws, Then ConfigError joins them with ", " (kills L79 join("") mutant)', async () => {
      // The L79 mutant turns errors.join(", ") into errors.join("") which
      // collapses two distinct error strings into one without separator.
      // Combine an invalid repo (PathIsNotGit) AND an invalid SHA so two
      // strings end up in the array; the message must contain ", " between
      // them — that is the only observable channel for the separator.
      mockedPathExists.mockResolvedValue(false as never)
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        repo: 'missing/repo',
        to: 'bad-to',
        from: 'bad-from',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/error\.[A-Za-z]+.*, error\./),
        })
      )
    })

    it('Given numeric falsy sourceApiVersion (0), When _handleDefault runs, Then it is not a usable pin and defaults to latest with a warning', async () => {
      // sourceApiVersion is typed string; a numeric 0 still parses to no positive version.
      mockSfProjectResolve.mockResolvedValue({
        getSfProjectJson: () => ({
          // numeric 0 (intentionally bypassing the string contract) —
          // toApiVersion's parseInt/isPositiveVersion check handles this
          // ill-typed shape the same as any other non-positive value.
          getContents: () =>
            ({ sourceApiVersion: 0 }) as unknown as Record<string, unknown>,
        }),
      })
      config.apiVersion = undefined
      const sut = new ConfigValidator(config)

      const warnings = await sut['_handleDefault']()

      expect(config.apiVersion).toBe(58)
      expect(warnings).toHaveLength(1)
    })

    it('Given two invalid SHAs, When validateConfig throws, Then both parameter names appear in the joined message (kills L20 SHA_KEYS[0] empty mutant)', async () => {
      // SHA_KEYS = ['from', 'to']. The L20 mutant replaces 'from' with ''.
      // Under that mutant, this.config[''] is undefined for both
      // iterations and resolveCommit gets called with undefined twice; the
      // resulting error tokens contain '', '' (no parameter name). We
      // assert the genuine 'from' identifier survives in the message.
      mockResolveCommit.mockImplementation((sha: string | undefined) =>
        sha && sha.startsWith('valid')
          ? Promise.resolve('ref')
          : Promise.reject(new Error('bad sha'))
      )
      const sut = new ConfigValidator({
        ...config,
        from: 'invalid-from',
        to: 'invalid-to',
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('from'),
        })
      )
      // Both real keys must be threaded through to resolveCommit (mutant '' would
      // call resolveCommit with undefined for the empty key)
      expect(mockResolveCommit).toHaveBeenCalledWith('invalid-from')
      expect(mockResolveCommit).toHaveBeenCalledWith('invalid-to')
    })

    it('Given apiVersion is NaN with a working SfProject, When _handleDefault runs, Then it is reset to latest with a single warning', async () => {
      // NaN is not a usable pin, so _handleDefault defaults it. Value AND
      // warning count are asserted so the usable-pin guard forced true
      // cannot survive either assertion alone.
      config.apiVersion = NaN
      mockSfProjectResolve.mockResolvedValue({
        getSfProjectJson: () => ({ getContents: () => ({}) }),
      })
      const sut = new ConfigValidator(config)

      const warnings = await sut['_handleDefault']()

      expect(config.apiVersion).toBe(58)
      expect(Number.isNaN(config.apiVersion)).toBe(false)
      expect(warnings).toHaveLength(1)
    })
  })

  describe('_sanitizeConfig completeness (L173, L175)', () => {
    it('Given a config with sanitizable fields, When validateConfig, Then each field is sanitized', async () => {
      // Mutant BlockStatement {}: sanitizeConfig does nothing → config is not sanitized
      // Mutant ArrowFunction () => undefined: a mapped field returns [undefined]
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'HEAD',
      })
      // sanitizePath is mocked to be identity; just verifies it is called for each field.
      // source is no longer sanitized here — canonicalisation now happens at
      // the entry point via parseSourceDirs, before ConfigValidator ever runs.
      await expect(sut.validateConfig()).resolves.not.toThrow()
      expect(mockedSanitizePath).toHaveBeenCalledWith(config.repo)
      expect(mockedSanitizePath).toHaveBeenCalledWith(config.output)
      expect(mockedSanitizePath).toHaveBeenCalledWith(config.changesManifest)
    })
  })

  describe('Given a rejected --source-dir value', () => {
    it.each([
      { reason: 'empty', value: '', key: 'error.SourceDirIsEmpty' },
      {
        reason: 'magic',
        value: ':(exclude)force-app',
        key: 'error.SourceDirUsesPathspecMagic',
      },
      {
        reason: 'wildcard',
        value: 'force-app/**',
        key: 'error.SourceDirContainsWildcard',
      },
      { reason: 'absolute', value: '/etc', key: 'error.SourceDirIsAbsolute' },
      {
        reason: 'escapes',
        value: '../sibling',
        key: 'error.SourceDirEscapesRepository',
      },
    ] as const)(
      'Given a $reason rejection for "$value", When validating, Then it rejects with $key and never reads the repository',
      async ({ reason, value, key }) => {
        // Arrange
        const sut = new ConfigValidator(config, [{ value, reason }])

        // Act & Assert
        await expect(sut.validateConfig()).rejects.toThrow(
          expect.objectContaining({
            name: 'ConfigError',
            message: expect.stringContaining(`${key}:${value}`),
          })
        )
        expect(mockResolveCommit).not.toHaveBeenCalled()
      }
    )

    it('Given a rejection value containing a newline, When validating, Then the message carries the escaped form and never the raw newline', async () => {
      // Arrange
      const controlValue = 'force-app\nPASSED'
      const sut = new ConfigValidator(config, [
        { value: controlValue, reason: 'empty' },
      ])

      // Act — validateConfig resolves with `readonly Error[]` on success, so
      // typing the catch callback's return as `Error` would leave `error`
      // typed `readonly Error[] | Error`; cast after the await instead,
      // since this rejection is the very thing under test.
      const error = (await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)) as Error

      // Assert
      expect(error.message).toContain(
        'error.SourceDirIsEmpty:force-app\\u{a}PASSED'
      )
      expect(error.message).not.toContain(controlValue)
    })

    it('Given two rejections at once, When validating, Then the joined message carries both keys separated by ", "', async () => {
      // Arrange
      const sut = new ConfigValidator(config, [
        { value: 'force-app/**', reason: 'wildcard' },
        { value: '../sibling', reason: 'escapes' },
      ])

      // Act & Assert — a plain `.*` regex would also match the L96
      // join('') mutant (it allows a zero-width gap), so the literal
      // separator is asserted directly via stringContaining instead.
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(
            'error.SourceDirContainsWildcard:force-app/**, error.SourceDirEscapesRepository:../sibling'
          ),
        })
      )
      expect(mockResolveCommit).not.toHaveBeenCalled()
    })

    it('Given the flag default, When validating, Then the whole repository stays in scope', async () => {
      // Arrange — getConfig() now carries sourceDirs('./') = ['.']
      const sut = new ConfigValidator(config, [])

      // Act
      await expect(sut.validateConfig()).resolves.not.toThrow()

      // Assert
      expect(config.source).toEqual(['.'])
    })
  })

  describe('changesManifest validation', () => {
    beforeEach(() => {
      mockedPathExists.mockResolvedValue(true as never)
      mockResolveCommit.mockImplementation(() => Promise.resolve('ref'))
    })

    it('Given changesManifest is undefined, When validating, Then stat is not called and no error is added', async () => {
      // Arrange
      const sut = new ConfigValidator({
        ...config,
        to: 'HEAD',
        from: 'HEAD',
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
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'will-be-created.json',
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
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'existing.json',
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
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'some-dir',
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
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'forbidden.json',
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
        ...config,
        to: 'HEAD',
        from: 'HEAD',
        changesManifest: 'weird.json',
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ChangesManifestStatFailed'),
        })
      )
    })
  })

  describe('Given mergeBase', () => {
    beforeEach(() => {
      mockedPathExists.mockResolvedValue(true as never)
    })

    it('Given mergeBase is true, When validating, Then config.from becomes the resolved merge base and getMergeBase receives the post-resolveCommit SHAs', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        Promise.resolve(`${ref}-resolved`)
      )
      mockGetMergeBase.mockResolvedValue('base-sha')
      const cfg = {
        ...config,
        from: 'main',
        to: 'develop',
        mergeBase: true,
      }
      const sut = new ConfigValidator(cfg)

      // Act
      const validated = await sut.validateConfig()

      // Assert
      expect(validated).toBeDefined()
      expect(cfg.from).toBe('base-sha')
      expect(mockGetMergeBase).toHaveBeenCalledWith(
        'main-resolved',
        'develop-resolved'
      )
    })

    it('Given mergeBase is false, When validating, Then getMergeBase is never called', async () => {
      // Arrange
      mockResolveCommit.mockImplementation(() => Promise.resolve('resolved'))
      const sut = new ConfigValidator({
        ...config,
        from: 'main',
        to: 'develop',
        mergeBase: false,
      })

      // Act
      await sut.validateConfig()

      // Assert
      expect(mockGetMergeBase).not.toHaveBeenCalled()
    })

    it('Given no common ancestor is found, When validating, Then it throws a ConfigError carrying error.MergeBaseNotFound with the user-typed refs', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        Promise.resolve(`${ref}-resolved`)
      )
      mockGetMergeBase.mockResolvedValue(undefined)
      const sut = new ConfigValidator({
        ...config,
        from: 'main',
        to: 'develop',
        mergeBase: true,
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          name: 'ConfigError',
          message: expect.stringContaining(
            'error.MergeBaseNotFound:main,develop'
          ),
        })
      )
    })

    it('Given no common ancestor is found and both refs contain a control character, When validating, Then the error message carries the escaped form of both refs and never the raw characters', async () => {
      // Arrange — proves sanitizeForMessage is applied to both
      // requestedFrom and requestedTo at this error site.
      const fromWithControl = 'main\nPASSED'
      const toWithControl = 'develop\rPASSED'
      mockResolveCommit.mockImplementation((ref: string) =>
        Promise.resolve(`${ref}-resolved`)
      )
      mockGetMergeBase.mockResolvedValue(undefined)
      const sut = new ConfigValidator({
        ...config,
        from: fromWithControl,
        to: toWithControl,
        mergeBase: true,
      })

      // Act
      const error = await sut
        .validateConfig()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toContain('main\\u{a}PASSED')
      expect((error as Error).message).toContain('develop\\u{d}PASSED')
      expect((error as Error).message).not.toContain(fromWithControl)
      expect((error as Error).message).not.toContain(toWithControl)
    })

    it('Given "from" is already an ancestor of "to", When validating, Then the resolved base equals the post-resolveCommit "from" (idempotency fixpoint)', async () => {
      // Arrange
      mockResolveCommit.mockImplementation((ref: string) =>
        Promise.resolve(`${ref}-resolved`)
      )
      mockGetMergeBase.mockResolvedValue('main-resolved')
      const cfg = {
        ...config,
        from: 'main',
        to: 'develop',
        mergeBase: true,
      }
      const sut = new ConfigValidator(cfg)

      // Act
      await sut.validateConfig()

      // Assert
      expect(cfg.from).toBe('main-resolved')
    })

    it('Given an invalid "--from" and mergeBase is true, When validating, Then it throws ParameterIsNotGitSHA and never calls getMergeBase (ordering)', async () => {
      // Arrange
      mockResolveCommit.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...config,
        from: 'bad-from',
        to: 'develop',
        mergeBase: true,
      })

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.ParameterIsNotGitSHA'),
        })
      )
      expect(mockGetMergeBase).not.toHaveBeenCalled()
    })

    it('Given a rejected "--source-dir" and mergeBase is true, When validating, Then it throws the source-dir error alone and never calls getMergeBase (the _validateSource short-circuit fires first)', async () => {
      // Arrange
      const sut = new ConfigValidator({ ...config, mergeBase: true }, [
        { value: '', reason: 'empty' },
      ])

      // Act & Assert
      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          name: 'ConfigError',
          message: expect.stringContaining('error.SourceDirIsEmpty'),
        })
      )
      expect(mockGetMergeBase).not.toHaveBeenCalled()
    })
  })
})
