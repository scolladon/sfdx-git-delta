'use strict'
import { describe, expect, it, jest } from '@jest/globals'

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
  resetIgnoreInstance,
  resetIncludeInstance,
} from '../../../../src/utils/ignoreHelper'

jest.mock('../../../../src/utils/fsUtils')
const mockedReadFile = jest.mocked(readFile)

describe('ignoreHelper', () => {
  let sut: IgnoreHelper
  const config: Config = {
    to: '',
    from: '',
    output: '',
    source: [''],
    ignore: '',
    ignoreDestructive: '',
    apiVersion: 0,
    repo: '',
    ignoreWhitespace: false,
    generateDelta: false,
    include: '',
    includeDestructive: '',
  }
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('buildIgnoreHelper', () => {
    it('returns cached instance on subsequent calls', async () => {
      // Arrange
      const firstCall = await buildIgnoreHelper(config)

      // Act
      const secondCall = await buildIgnoreHelper(config)

      // Assert
      expect(secondCall).toBe(firstCall)
      resetIgnoreInstance()
    })

    describe('when config does not have ignore neither destructive ignore', () => {
      beforeAll(async () => {
        // Arrange
        sut = await buildIgnoreHelper(config)
      })
      afterAll(() => {
        resetIgnoreInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
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
        config.ignoreDestructive = 'path'
        sut = await buildIgnoreHelper(config)
      })

      afterAll(() => {
        resetIgnoreInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignoreDestructive pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
      ])('should not keep deleted "%s" line matching ignoreDestructive pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])('should not keep deleted "%s" line matching default ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

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
        config.ignore = 'path'
        sut = await buildIgnoreHelper(config)
      })

      afterAll(() => {
        resetIgnoreInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance (with default ignore)', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
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
      ])('should not keep deleted "%s" line matching default ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })
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
        resetIgnoreInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
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
      ])('should not keep deleted "%s" line matching default ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
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
        sut = await buildIncludeHelper(config)
      })
      afterAll(() => {
        resetIncludeInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
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
        config.includeDestructive = 'path'
        sut = await buildIncludeHelper(config)
      })

      afterAll(() => {
        resetIncludeInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching includeDestructive pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
      ])('should not keep deleted "%s" line matching includeDestructive pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

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
        config.include = 'path'
        config.includeDestructive = ''
        sut = await buildIncludeHelper(config)
      })

      afterAll(() => {
        resetIncludeInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
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
        config.include = 'path'
        config.includeDestructive = 'path'
        sut = await buildIncludeHelper(config)
      })

      afterAll(() => {
        resetIncludeInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut['destructiveIgnore']).toBeDefined()
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
