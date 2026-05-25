import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PATH_SEP } from '../../../../src/constant/fsConstants'
import {
  fs,
  isSamePath,
  isSubDir,
  outputFile,
  pathExists,
  readFile,
  sanitizePath,
  treatPathSep,
} from '../../../../src/utils/fsUtils'
import { Logger } from '../../../../src/utils/LoggingService'

const mockedReadFile = vi.spyOn(fs, 'readFile')
const mockedAccess = vi.spyOn(fs, 'access')
const mockedMkdir = vi.spyOn(fs, 'mkdir')
const mockedWriteFile = vi.spyOn(fs, 'writeFile')

beforeEach(() => {
  vi.resetAllMocks()
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
  ])(`should verify %s expect %s to be a subDir: %s`, (parent, child, expected) => {
    // Arrange

    // Act
    const actual = isSubDir(parent, child)

    // Assert
    expect(actual).toBe(expected)
  })
})

describe('readFile', () => {
  describe('when readfile succeed', () => {
    beforeEach(() => {
      // Arrange
      mockedReadFile.mockResolvedValue('content')
    })
    it('should return the file content', async () => {
      // Act
      const sut = await readFile('path')

      // Assert
      expect(sut).toBe('content')
    })

    it('When called, Then passes encoding option to fs.readFile (not an empty object)', async () => {
      // Arrange — the { encoding: UTF8_ENCODING } object at L45 is a
      // mutation target: replacing it with {} drops the encoding, causing
      // readFile to return a Buffer instead of a string. We assert the
      // actual options object that was forwarded.
      // Act
      await readFile('path')

      // Assert — second argument must include the encoding property
      expect(mockedReadFile).toHaveBeenCalledWith(
        'path',
        expect.objectContaining({ encoding: 'utf8' })
      )
    })
  })

  describe('when readfile throw', () => {
    beforeEach(() => {
      // Arrange
      mockedReadFile.mockRejectedValue('Error')
    })
    it('should throw', async () => {
      // Act & Assert
      await expect(readFile('path')).rejects.toBe('Error')
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
    const debugSpy = vi
      .spyOn(Logger, 'debug')
      .mockImplementation((msg: unknown) => {
        if (typeof msg === 'function') (msg as () => void)()
      })

    // Act
    const result = await pathExists('not/accessible/path')

    // Assert
    expect(result).toBe(false)
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })
})

describe('outputFile', () => {
  it('Given a destination and content, When called, Then mkdir is invoked recursively on the parent and writeFile writes the content', async () => {
    // Arrange
    mockedMkdir.mockResolvedValue(undefined as never)
    mockedWriteFile.mockResolvedValue(undefined as never)

    // Act
    await outputFile('out/nested/dir/file.txt', 'payload')

    // Assert
    expect(mockedMkdir).toHaveBeenCalledWith('out/nested/dir', {
      recursive: true,
    })
    expect(mockedWriteFile).toHaveBeenCalledWith(
      'out/nested/dir/file.txt',
      'payload'
    )
  })

  it('Given a Buffer payload, When called, Then writeFile receives the same Buffer reference', async () => {
    // Arrange
    mockedMkdir.mockResolvedValue(undefined as never)
    mockedWriteFile.mockResolvedValue(undefined as never)
    const buf = Buffer.from([0x01, 0x02, 0x03])

    // Act
    await outputFile('out/binary.bin', buf)

    // Assert
    expect(mockedWriteFile).toHaveBeenCalledWith('out/binary.bin', buf)
  })

  it('Given mkdir rejects, When called, Then the error propagates and writeFile is not invoked', async () => {
    // Arrange
    const boom = new Error('permission denied')
    mockedMkdir.mockRejectedValue(boom as never)

    // Act / Assert
    await expect(outputFile('out/file.txt', 'payload')).rejects.toBe(boom)
    expect(mockedWriteFile).not.toHaveBeenCalled()
  })
})
