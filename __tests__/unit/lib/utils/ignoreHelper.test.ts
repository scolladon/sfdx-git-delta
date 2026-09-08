'use strict'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import type { Config } from '../../../../src/types/config'
import { readFile } from '../../../../src/utils/fsUtils'
import {
  buildIgnoreHelper,
  buildIncludeHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { sourceDirs } from '../../../__utils__/sourceDirs'

vi.mock('../../../../src/utils/fsUtils', async orig => ({
  ...(await orig<typeof import('../../../../src/utils/fsUtils')>()),
  readFile: vi.fn(),
}))
const mockedReadFile = vi.mocked(readFile)

const getConfig = (): Config => ({
  to: '',
  from: '',
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  ignore: '',
  ignoreDestructive: '',
  apiVersion: 0,
  repo: '',
  ignoreWhitespace: false,
  generateDelta: false,
  include: '',
  includeDestructive: '',
})

describe('ignoreHelper', () => {
  let sut: IgnoreHelper
  let config: Config
  beforeEach(() => {
    config = getConfig()
    vi.resetAllMocks()
  })

  // Both helpers are cached in static fields, so a suite that builds one leaves
  // it for whatever runs next: the next suite's beforeAll gets the cached
  // instance back instead of building its own, and asserts against another
  // suite's rules. Clearing after every test is what makes this file
  // order-independent.
  afterEach(() => {
    IgnoreHelper.resetIgnoreInstance()
    IgnoreHelper.resetIncludeInstance()
  })
  describe('buildIgnoreHelper', () => {
    it('returns cached instance on subsequent calls', async () => {
      // Arrange
      const firstCall = await buildIgnoreHelper(config)

      // Act
      const secondCall = await buildIgnoreHelper(config)

      // Assert
      expect(secondCall).toBe(firstCall)
    })

    describe('when config does not have ignore neither destructive ignore', () => {
      beforeAll(async () => {
        // Arrange
        sut = await buildIgnoreHelper(getConfig())
      })
      afterAll(() => {
        IgnoreHelper.resetIgnoreInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
        `${DELETION} path/to/file.ext`,
        `! path/to/file.ext`,
      ])('should keep "%s" line', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config does not have ignore and have destructive ignore', () => {
      beforeAll(async () => {
        // Arrange
        mockedReadFile.mockResolvedValue('*ignoreFile*')
        sut = await buildIgnoreHelper({
          ...getConfig(),
          ignoreDestructive: 'path',
        })
      })

      afterAll(() => {
        IgnoreHelper.resetIgnoreInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])(
        'should keep deleted "%s" line not matching ignoreDestructive pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(true)
        }
      )

      it.each([`${DELETION} path/to/ignoreFile.ext`])(
        'should not keep deleted "%s" line matching ignoreDestructive pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )

      it.each([
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])(
        'should not keep deleted "%s" line matching default ignore pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config has ignore and does not have destructive ignore', () => {
      beforeAll(async () => {
        // Arrange
        mockedReadFile.mockImplementation(() => Promise.resolve('*ignoreFile*'))
        sut = await buildIgnoreHelper({ ...getConfig(), ignore: 'path' })
      })

      afterAll(() => {
        IgnoreHelper.resetIgnoreInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance (with default ignore)', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/ignoreFile.ext`,
        `${MODIFICATION} path/to/ignoreFile.ext`,
      ])('should not keep changed "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
        `${DELETION} anotherPath/to/ignoreFile.ext`,
        `${DELETION} path/to/anotherignoreFile.ext`,
      ])('should not keep deleted "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])(
        'should not keep deleted "%s" line matching default ignore pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )
    })
    describe('when config has ignore and destructive ignore', () => {
      beforeAll(async () => {
        // Arrange
        mockedReadFile.mockResolvedValueOnce('*ignoreFile*')
        mockedReadFile.mockResolvedValueOnce('*ignoreFile*')
        const config = { ignore: 'path', ignoreDestructive: 'otherPath' }
        sut = await buildIgnoreHelper(config)
      })

      afterAll(() => {
        IgnoreHelper.resetIgnoreInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/ignoreFile.ext`,
        `${MODIFICATION} path/to/ignoreFile.ext`,
      ])('should not keep changed "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
        `${DELETION} anotherPath/to/ignoreFile.ext`,
        `${DELETION} path/to/anotherignoreFile.ext`,
      ])('should not keep deleted "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])(
        'should not keep deleted "%s" line matching default ignore pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )
    })

    describe('Given a missing ignore file', () => {
      afterEach(() => {
        IgnoreHelper.resetIgnoreInstance()
      })

      it('When readFile rejects, Then buildIgnoreHelper propagates the rejection', async () => {
        // Arrange
        IgnoreHelper.resetIgnoreInstance()
        const error = Object.assign(
          new Error(
            "ENOENT: no such file or directory, open '.missing-ignore-file'"
          ),
          { code: 'ENOENT' }
        )
        mockedReadFile.mockRejectedValue(error)
        const buildFromConfig = buildIgnoreHelper

        // Act & Assert
        await expect(
          buildFromConfig({ ...getConfig(), ignore: '.missing-ignore-file' })
        ).rejects.toMatchObject({
          code: 'ENOENT',
        })
      })
    })
  })

  describe('buildIncludeHelper', () => {
    it('build once', async () => {
      // Arrange
      sut = await buildIncludeHelper(config)

      // Act
      const result = await buildIncludeHelper(config)

      // Assert
      expect(result).toBe(sut)
    })

    describe('when config does not have include neither destructive include', () => {
      beforeAll(async () => {
        // Arrange
        sut = await buildIncludeHelper(getConfig())
      })
      afterAll(() => {
        IgnoreHelper.resetIncludeInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
        `${DELETION} path/to/file.ext`,
        `! path/to/file.ext`,
      ])('should keep "%s" line', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config does not have include and have destructive include', () => {
      beforeAll(async () => {
        // Arrange
        mockedReadFile.mockImplementation(() => Promise.resolve('*ignoreFile*'))
        sut = await buildIncludeHelper({
          ...getConfig(),
          includeDestructive: 'path',
        })
      })

      afterAll(() => {
        IgnoreHelper.resetIncludeInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])(
        'should keep deleted "%s" line not matching includeDestructive pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(true)
        }
      )

      it.each([`${DELETION} path/to/ignoreFile.ext`])(
        'should not keep deleted "%s" line matching includeDestructive pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config has include and does not have destructive include', () => {
      beforeAll(async () => {
        // Arrange
        mockedReadFile.mockImplementation(() => Promise.resolve('*ignoreFile*'))
        sut = await buildIncludeHelper({
          ...getConfig(),
          include: 'path',
          includeDestructive: '',
        })
      })

      afterAll(() => {
        IgnoreHelper.resetIncludeInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/ignoreFile.ext`,
        `${MODIFICATION} path/to/ignoreFile.ext`,
      ])('should not keep changed "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
        `${DELETION} anotherPath/to/ignoreFile.ext`,
        `${DELETION} path/to/anotherignoreFile.ext`,
      ])('should keep deleted "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config has include and destructive include', () => {
      beforeAll(async () => {
        // Arrange
        mockedReadFile.mockResolvedValueOnce('*ignoreFile*')
        mockedReadFile.mockResolvedValueOnce('*ignoreFile*')
        sut = await buildIncludeHelper({
          ...getConfig(),
          include: 'path',
          includeDestructive: 'path',
        })
      })

      afterAll(() => {
        IgnoreHelper.resetIncludeInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut.keep(`${DELETION} path/to/file.ext`)).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/ignoreFile.ext`,
        `${MODIFICATION} path/to/ignoreFile.ext`,
      ])('should not keep changed "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
        `${DELETION} anotherPath/to/ignoreFile.ext`,
        `${DELETION} path/to/anotherignoreFile.ext`,
      ])('should not keep deleted "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })
    })
  })
})
