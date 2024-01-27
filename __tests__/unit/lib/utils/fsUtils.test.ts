'use strict'
import { sep } from 'path'

import { expect, jest, describe, it } from '@jest/globals'
import { Stats, stat, readFile as fsReadFile } from 'fs-extra'

import {
  dirExists,
  fileExists,
  isSubDir,
  readFile,
  sanitizePath,
  treatPathSep,
} from '../../../../src/utils/fsUtils'

jest.mock('fs-extra')

const mockedStat = jest.mocked(stat)
const mockedReadFile = jest.mocked(fsReadFile)

beforeEach(() => {
  jest.resetAllMocks()
})

describe('isSubDir', () => {
  describe('when parent contains dir', () => {
    it('returns true', async () => {
      // Arrange

      // Act
      const result = isSubDir('parent', 'parent/dir')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('when parent does not contains dir', () => {
    it('returns false', async () => {
      // Arrange

      // Act
      const result = isSubDir('parent', 'dir/child')

      // Assert
      expect(result).toBe(false)
    })
  })
  it.each([
    ['/foo', '/foo', false],
    ['/foo', '/bar', false],
    ['/foo', '/foobar', false],
    ['/foo', '/foo/bar', true],
    ['/foo', '/foo/../bar', false],
    ['/foo', '/foo/./bar', true],
    ['/bar/../foo', '/foo/bar', true],
    ['/foo', './bar', false],
    ['C:\\Foo', 'C:\\Foo\\Bar', false],
    ['C:\\Foo', 'C:\\Bar', false],
    ['C:\\Foo', 'D:\\Foo\\Bar', false],
  ])(
    `should verify %s expect %s to be a subDir: %s`,
    (parent, child, expected) => {
      // Arrange

      // Act
      const actual = isSubDir(parent, child)

      // Assert
      expect(actual).toBe(expected)
    }
  )
})

describe('dirExists', () => {
  it('returns true when dir exist', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isDirectory: () => true,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await dirExists('test')

    // Assert
    expect(exist).toBe(true)
  })

  it('returns false when dir does not exist', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isDirectory: () => false,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await dirExists('test')

    // Assert
    expect(exist).toBe(false)
  })

  it('returns false when an exception occurs', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.reject(new Error('test'))) as unknown as typeof stat)

    // Act
    const exist = await dirExists('test')

    // Assert
    expect(exist).toBe(false)
  })
})

describe('fileExists', () => {
  it('returns true when file exist', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isFile: () => true,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await fileExists('test')

    // Assert
    expect(exist).toBe(true)
  })

  it('returns false when file does not exist', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isFile: () => false,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await fileExists('test')

    // Assert
    expect(exist).toBe(false)
  })

  it('returns false when an exception occurs', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.reject(new Error('test'))) as unknown as typeof stat)

    // Act
    const exist = await fileExists('test')

    // Assert
    expect(exist).toBe(false)
  })
})

describe('readFile', () => {
  describe('when readfile succeed', () => {
    beforeEach(() => {
      // Arrange
      mockedReadFile.mockImplementationOnce((() =>
        Promise.resolve('content')) as unknown as typeof mockedReadFile)
    })
    it('should return the file', async () => {
      // Act
      const file = await readFile('path')

      // Assert
      expect(file).toBeTruthy()
      expect(mockedReadFile).toHaveBeenCalled()
    })
  })

  describe('when readfile throw', () => {
    beforeEach(() => {
      // Arrange
      mockedReadFile.mockImplementationOnce((() =>
        Promise.reject('Error')) as unknown as typeof mockedReadFile)
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path')
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(mockedReadFile).toHaveBeenCalled()
      }
    })
  })
})

describe('treatPathSep', () => {
  it(`replace / by ${sep}`, () => {
    // Arrange
    const input = 'test///test//test/test'

    // Act
    const result = treatPathSep(input)

    // Assert
    expect(result).toBe(`test${sep}test${sep}test${sep}test`)
  })

  it(`replace \\ by ${sep}`, () => {
    // Arrange
    const input = 'test\\\\\\test\\\\test\\test'

    // Act
    const result = treatPathSep(input)

    // Assert
    expect(result).toBe(`test${sep}test${sep}test${sep}test`)
  })
})

describe('sanitizePath', () => {
  it(`returns path with '${sep}' separator`, () => {
    // Arrange
    const input = 'test\\test/test'

    // Act
    const result = sanitizePath(input)

    // Assert
    expect(result).toBe(`test${sep}test${sep}test`)
  })

  it(`normalize path`, () => {
    // Arrange
    const input = 'test/test\\../test'

    // Act
    const result = sanitizePath(input)

    // Assert
    expect(result).toBe(`test${sep}test`)
  })

  it('return empty string when data is empty string', () => {
    // Arrange
    const input = ''

    // Act
    const result = sanitizePath(input)

    // Assert
    expect(result).toBe('')
  })
})
