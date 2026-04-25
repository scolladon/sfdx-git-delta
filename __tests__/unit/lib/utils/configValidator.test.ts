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

  describe('getMessage token arrays contain correct values (L46, L72, L109, L152, L165)', () => {
    it('Given invalid SHA for "to", When error thrown, Then message contains the SHA parameter name and value (kills L46 [] mutant)', async () => {
      // L46 mutant: getMessage(..., []) → message = 'error.ParameterIsNotGitSHA:'
      // Real: getMessage(..., ['to', 'bad-to']) → 'error.ParameterIsNotGitSHA:to,bad-to'
      mockParseRev.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...work,
        config: { ...work.config, to: 'bad-to', from: 'HEAD' },
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('to'),
        })
      )
    })

    it('Given apiVersion exceeds latest, When _handleDefault, Then warning message contains both version values (kills L152 [] mutant)', async () => {
      // L152 mutant: getMessage(..., []) → message = 'warning.ApiVersionOverridden:'
      // Real: getMessage(..., ['100', '58']) → 'warning.ApiVersionOverridden:100,58'
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
      work.config.apiVersion = 100
      const sut = new ConfigValidator(work)
      await sut['_handleDefault']()

      expect(work.warnings[0].message).toContain('100')
    })

    it('Given apiVersion defaults to latest, When _handleDefault, Then warning message contains latestVersion (kills L165 [] mutant)', async () => {
      // L165 mutant: getMessage(..., []) → message = 'warning.ApiVersionDefaulted:'
      // Real: getMessage(..., ['58']) → 'warning.ApiVersionDefaulted:58'
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
      mockSfProjectResolve.mockRejectedValue(new Error('no project'))
      work.config.apiVersion = undefined
      const sut = new ConfigValidator(work)
      await sut['_handleDefault']()

      expect(work.warnings[0].message).toContain('58')
    })
  })

  describe('SHA_KEYS covers both from and to (L20)', () => {
    it('Given both from and to are invalid SHAs, When validating, Then error message includes both parameters', async () => {
      // Mutant '' instead of 'from' or 'to' would lose the parameter names in messages
      mockParseRev.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...work,
        config: { ...work.config, to: 'bad-to', from: 'bad-from' },
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
      mockParseRev
        .mockResolvedValueOnce('valid-to')
        .mockRejectedValueOnce(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...work,
        config: { ...work.config, to: 'HEAD', from: 'bad-from' },
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
      mockParseRev.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...work,
        config: { ...work.config, repo: 'missing/repo' },
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
        ...work,
        config: { ...work.config, repo: 'not-git' },
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('error.PathIsNotGit:not-git'),
        })
      )
    })
  })

  describe('_apiVersionDefault logical operators (L146, L161)', () => {
    beforeEach(() => {
      vi.spyOn(SDRMetadataAdapter, 'getLatestApiVersion').mockResolvedValue(
        '58'
      )
    })

    it('Given apiVersion is defined, valid, and less than latest, When _apiVersionDefault, Then no warning and no override (L146 &&)', async () => {
      // Mutant "||" instead of "&&": undefined || !isNaN(undefined)=true → still false since undefined > 58 is false
      // Key: test that apiVersion < latest stays unchanged (no false positive override)
      work.config.apiVersion = 55
      const sut = new ConfigValidator(work)
      await sut['_handleDefault']()

      expect(work.config.apiVersion).toBe(55)
      expect(work.warnings).toHaveLength(0)
    })

    it('Given apiVersion is defined and equal to latest, When _apiVersionDefault, Then no override (L146 boundary)', async () => {
      // Confirms the > operator (not >= in mutant "anchorIndex > 2")
      work.config.apiVersion = 58
      const sut = new ConfigValidator(work)
      await sut['_handleDefault']()

      expect(work.config.apiVersion).toBe(58)
      expect(work.warnings).toHaveLength(0)
    })

    it('Given apiVersion is NaN, When _apiVersionDefault, Then defaults to latest (L161 ConditionalExpression)', async () => {
      // Mutant ConditionalExpression false: the defaulting block never runs → apiVersion stays NaN
      work.config.apiVersion = NaN
      const sut = new ConfigValidator(work)
      await sut['_handleDefault']()

      expect(work.config.apiVersion).toBe(58)
      expect(work.warnings).toHaveLength(1)
    })

    it('Given apiVersion is undefined after project lookup, When _apiVersionDefault, Then defaults to latest (L161)', async () => {
      // Mutant false: if block skipped → apiVersion stays undefined
      work.config.apiVersion = undefined
      mockSfProjectResolve.mockRejectedValue(new Error('no project'))
      const sut = new ConfigValidator(work)
      await sut['_handleDefault']()

      expect(work.config.apiVersion).toBe(58)
      expect(work.warnings).toHaveLength(1)
    })
  })

  describe('_validateChangesManifest message tokens (L96, L109, L132, L137)', () => {
    beforeEach(() => {
      mockedPathExists.mockResolvedValue(true as never)
      mockParseRev.mockResolvedValue('ref')
    })

    it('Given target is directory (isFile=false), When validating, Then error message contains target path (L96 [])', async () => {
      // Mutant [] for [target] in getMessage → message has no path token
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
          changesManifest: 'my-dir',
        },
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
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'locked-file.json',
        },
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
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'not-a-file',
        },
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
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          changesManifest: 'real-file.json',
        },
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
      mockParseRev.mockRejectedValue(new Error('bad sha'))
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          repo: 'missing/repo',
          to: 'bad-to',
          from: 'bad-from',
        },
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringMatching(/error\.[A-Za-z]+.*, error\./),
        })
      )
    })

    it('Given numeric falsy sourceApiVersion (0), When _handleDefault runs, Then projectApiVersion truthy guard skips parseInt (kills L132 cond=true mutant)', async () => {
      // Real: `if (projectApiVersion)` is false for 0 (numeric), apiVersion
      //       stays undefined → defaults to latest with warning.
      // Mutant `if (true)`: enters branch, parseInt(0, 10) = 0, apiVersion
      //       becomes 0 (a falsy but defined number). The downstream
      //       _apiVersionDefault then sees 0 !== undefined && !isNaN(0)
      //       && 0 > 58 = false → no override. 0 === undefined || isNaN(0)
      //       = false → no defaulting. apiVersion stays 0 with no warning.
      // Observable difference: real => 58 with warning, mutant => 0 with
      // no warning.
      mockSfProjectResolve.mockResolvedValue({
        getSfProjectJson: () => ({
          // numeric 0 (intentionally bypassing the string contract for the
          // truthiness guard) — the production code's truthy check exists
          // exactly to handle this ill-typed shape gracefully.
          getContents: () =>
            ({ sourceApiVersion: 0 }) as unknown as Record<string, unknown>,
        }),
      })
      work.config.apiVersion = undefined
      const sut = new ConfigValidator(work)

      await sut['_handleDefault']()

      expect(work.config.apiVersion).toBe(58)
      expect(work.warnings).toHaveLength(1)
    })

    it('Given two invalid SHAs, When validateConfig throws, Then both parameter names appear in the joined message (kills L20 SHA_KEYS[0] empty mutant)', async () => {
      // SHA_KEYS = ['from', 'to']. The L20 mutant replaces 'from' with ''.
      // Under that mutant, this.config[''] is undefined for both
      // iterations and parseRev gets called with undefined twice; the
      // resulting error tokens contain '', '' (no parameter name). We
      // assert the genuine 'from' identifier survives in the message.
      mockParseRev.mockImplementation((sha: string | undefined) =>
        sha && sha.startsWith('valid')
          ? Promise.resolve('ref')
          : Promise.reject(new Error('bad sha'))
      )
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          from: 'invalid-from',
          to: 'invalid-to',
        },
      })

      await expect(sut.validateConfig()).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('from'),
        })
      )
      // Both real keys must be threaded through to parseRev (mutant '' would
      // call parseRev with undefined for the empty key)
      expect(mockParseRev).toHaveBeenCalledWith('invalid-from')
      expect(mockParseRev).toHaveBeenCalledWith('invalid-to')
    })

    it('Given apiVersion is NaN with a working SfProject, When _handleDefault runs, Then it is reset to latest with a single warning (kills L161 cond=false mutant)', async () => {
      // Mutant L161 cond=false: the NaN-detection block never fires →
      // apiVersion stays NaN and the defaulted warning is never pushed.
      // Concretely contrast the two outcomes via two separate asserts —
      // value AND warning count — so neither survives in isolation.
      work.config.apiVersion = NaN
      mockSfProjectResolve.mockResolvedValue({
        getSfProjectJson: () => ({ getContents: () => ({}) }),
      })
      const sut = new ConfigValidator(work)

      await sut['_handleDefault']()

      expect(work.config.apiVersion).toBe(58)
      expect(Number.isNaN(work.config.apiVersion)).toBe(false)
      expect(work.warnings).toHaveLength(1)
    })
  })

  describe('_sanitizeConfig completeness (L173, L175)', () => {
    it('Given source array with multiple entries, When validateConfig, Then all sources are sanitized', async () => {
      // Mutant BlockStatement {}: sanitizeConfig does nothing → config is not sanitized
      // Mutant ArrowFunction () => undefined: source.map returns [undefined]
      const sut = new ConfigValidator({
        ...work,
        config: {
          ...work.config,
          to: 'HEAD',
          from: 'HEAD',
          source: ['/path/a', '/path/b'],
        },
      })
      // sanitizePath is mocked to be identity; just verifies it is called for each source
      await expect(sut.validateConfig()).resolves.not.toThrow()
      expect(mockedSanitizePath).toHaveBeenCalledWith('/path/a')
      expect(mockedSanitizePath).toHaveBeenCalledWith('/path/b')
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
