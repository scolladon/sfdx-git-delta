'use strict'
import { access, readFile as fsReadFile, stat } from 'node:fs/promises'
import { describe, expect, it, jest } from '@jest/globals'

import { PATH_SEP } from '../../../../src/constant/fsConstants'
import {
  dirExists,
  fileExists,
  isSamePath,
  isSubDir,
  pathExists,
  readFile,
  sanitizePath,
  treatPathSep,
} from '../../../../src/utils/fsUtils'

jest.mock('node:fs/promises')

const mockedStat = jest.mocked(stat)
const mockedReadFile = jest.mocked(fsReadFile)
const mockedAccess = jest.mocked(access)

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
      })) as unknown as typeof stat)

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
      })) as unknown as typeof stat)

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
      })) as unknown as typeof stat)

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
      })) as unknown as typeof stat)

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

describe.each(['/', '\\'])('treatPathSep', sep => {
  it(`replace ${sep} by ${PATH_SEP}`, () => {
    // Arrange
    const input = `test${sep + sep + sep}test${sep + sep}test${sep}test`

    // Act
    const result = treatPathSep(input)

    // Assert
    expect(result).toBe(`test${PATH_SEP}test${PATH_SEP}test${PATH_SEP}test`)
  })

  it(`keeps the leading ${sep}`, () => {
    // Arrange
    const input = `${sep}test${sep}test`

    // Act
    const result = treatPathSep(input)

    // Assert
    expect(result).toBe(`${PATH_SEP}test${PATH_SEP}test`)
  })

  it(`keeps the trailing ${sep}`, () => {
    // Arrange
    const input = `test${sep}test${sep}`

    // Act
    const result = treatPathSep(input)

    // Assert
    expect(result).toBe(`test${PATH_SEP}test${PATH_SEP}`)
  })
})

describe('sanitizePath', () => {
  it(`returns path with '${PATH_SEP}' separator`, () => {
    // Arrange
    const input = 'test\\test/test'

    // Act
    const result = sanitizePath(input)

    // Assert
    expect(result).toBe(`test${PATH_SEP}test${PATH_SEP}test`)
  })

  it(`normalize path`, () => {
    // Arrange
    const input = 'test/test\\../test'

    // Act
    const result = sanitizePath(input)

    // Assert
    expect(result).toBe(`test${PATH_SEP}test`)
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

describe('isSamePath', () => {
  describe.each([
    ['.', './'],
    ['output/', 'output'],
    ['./output/', 'output'],
    ['./output/test/..', 'output'],
  ])('when "%s" is equal to "%s"', (a, b) => {
    it('should be detected as the same path', () => {
      // Act
      const result = isSamePath(a, b)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe.each([
    ['.', 'test'],
    ['output/', 'test'],
    ['./output/', 'test'],
    ['./output/test/..', 'test'],
  ])('when "%s" is different to "%s"', (a, b) => {
    it('should be detected as the different path', () => {
      // Act
      const result = isSamePath(a, b)

      // Assert
      expect(result).toBe(false)
    })
  })
})

describe('pathExists', () => {
  it('returns true when path is accessible', async () => {
    // Arrange
    mockedAccess.mockResolvedValue(true as never)
    const sut = pathExists

    // Act
    const result = await sut('accessible/path')

    // Assert
    expect(result).toBe(true)
  })

  it('returns false when path is not accessible', async () => {
    // Arrange
    mockedAccess.mockRejectedValue(new Error('not accessible'))
    const sut = pathExists

    // Act
    const result = await sut('not/accessible/path')

    // Assert
    expect(result).toBe(false)
  })
})
