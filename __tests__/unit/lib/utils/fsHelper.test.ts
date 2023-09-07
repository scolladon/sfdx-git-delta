'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getWork } from '../../../__utils__/globalTestHelper'
import {
  copyFiles,
  dirExists,
  fileExists,
  gitPathSeparatorNormalizer,
  isGit,
  isSubDir,
  pathExists,
  readDir,
  readFile,
  readPathFromGit,
  scan,
  scanExtension,
  writeFile,
} from '../../../../src/utils/fsHelper'
import {
  getSpawnContent,
  treatPathSep,
} from '../../../../src/utils/childProcessUtils'
import { Stats, outputFile, stat } from 'fs-extra'
import { EOL } from 'os'
import { Work } from '../../../../src/types/work'
import { Config } from '../../../../src/types/config'

jest.mock('fs-extra')
jest.mock('../../../../src/utils/childProcessUtils', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualModule: any = jest.requireActual(
    '../../../../src/utils/childProcessUtils'
  )
  return {
    ...actualModule,
    getSpawnContent: jest.fn(),
    treatPathSep: jest.fn(),
  }
})

const mockedGetStreamContent = jest.mocked(getSpawnContent)
const mockedTreatPathSep = jest.mocked(treatPathSep)
const mockedStat = jest.mocked(stat)

let work: Work
beforeEach(() => {
  jest.resetAllMocks()
  work = getWork()
  work.config.from = 'pastsha'
  work.config.from = 'recentsha'
})

describe('gitPathSeparatorNormalizer', () => {
  it('replaces every instance of \\', async () => {
    // Arrange
    const windowsPath = 'path\\to\\a\\\\file'

    // Act
    const result = gitPathSeparatorNormalizer(windowsPath)

    // Assert
    expect(result).toEqual('path/to/a/file')
  })
})

describe('readPathFromGit', () => {
  describe.each([
    ['windows', 'force-app\\main\\default\\classes\\myClass.cls'],
    ['unix', 'force-app/main/default/classes/myClass.cls'],
  ])('when path is %s format', (_, path) => {
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(Buffer.from(''))
    })

    it('should use "config.to" and "normalized path" to get git history', async () => {
      // Act
      await readPathFromGit(path, work.config)

      // Assert
      const normalizedPath = path.replace(/\\+/g, '/')
      expect(getSpawnContent).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining([`${work.config.to}:${normalizedPath}`]),
        expect.anything()
      )
    })
  })

  describe.each([undefined, null])('when path returned "%s"', value => {
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(value as unknown as Buffer)
    })

    it('should use "config.to" and "normalized path" to get git history', async () => {
      // Act
      const content = await readPathFromGit('path/file', work.config)

      // Assert
      expect(content).toBe('')
    })
  })
})

describe('copyFile', () => {
  describe('when file is already copied', () => {
    it('should not copy file', async () => {
      await copyFiles(work.config, 'source/file')
      jest.resetAllMocks()

      // Act
      await copyFiles(work.config, 'source/file')

      // Assert
      expect(getSpawnContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when file is already written', () => {
    it('should not copy file', async () => {
      // Arrange
      mockedTreatPathSep.mockReturnValueOnce('file')
      await writeFile('source/file', 'content', work.config)
      jest.resetAllMocks()

      // Act
      await copyFiles(work.config, 'source/file')

      // Assert
      expect(getSpawnContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is empty', () => {
    it('should copy file', async () => {
      // Arrange
      mockedTreatPathSep.mockReturnValueOnce('source/copyFile')
      mockedGetStreamContent.mockResolvedValue(Buffer.from(''))

      // Act
      await copyFiles(work.config, 'source/doNotCopy')

      // Assert
      expect(getSpawnContent).toBeCalled()
      expect(outputFile).toBeCalledWith(
        'output/source/copyFile',
        Buffer.from('')
      )
    })
  })

  describe('when source location is not empty', () => {
    describe('when content is a folder', () => {
      it('should copy the folder', async () => {
        // Arrange
        mockedTreatPathSep.mockReturnValueOnce('copyDir/copyFile')
        mockedGetStreamContent.mockResolvedValueOnce(
          Buffer.from('tree HEAD:folder\n\ncopyFile')
        )
        mockedGetStreamContent.mockResolvedValue(Buffer.from('content'))

        // Act
        await copyFiles(work.config, 'source/copyDir')

        // Assert
        expect(getSpawnContent).toBeCalledTimes(2)
        expect(outputFile).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          'output/copyDir/copyFile',
          Buffer.from('content')
        )
        expect(treatPathSep).toBeCalledTimes(1)
      })
    })
    describe('when content is not a git location', () => {
      it('should ignore this path', async () => {
        // Arrange
        const sourcePath = 'source/warning'
        mockedGetStreamContent.mockRejectedValue(
          `fatal: path '${sourcePath}' does not exist in 'HEAD'`
        )

        // Act
        await copyFiles(work.config, sourcePath)

        // Assert
        expect(getSpawnContent).toBeCalled()
        expect(outputFile).not.toBeCalled()
      })
    })
    describe('when content is a file', () => {
      beforeEach(async () => {
        // Arrange
        mockedGetStreamContent.mockResolvedValue(Buffer.from('content'))
        mockedTreatPathSep.mockReturnValueOnce('source/copyFile')
      })
      it('should copy the file', async () => {
        // Act
        await copyFiles(work.config, 'source/copyfile')

        // Assert
        expect(getSpawnContent).toBeCalled()
        expect(outputFile).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          'output/source/copyFile',
          Buffer.from('content')
        )
        expect(treatPathSep).toBeCalledTimes(1)
      })
    })
  })
})

describe('readDir', () => {
  describe('when getSpawnContent succeed', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(
        Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return the file', async () => {
      // Act
      const dirContent = await readDir(dir, work.config)

      // Assert
      expect(dirContent).toEqual(expect.arrayContaining([`${file}`]))
      expect(getSpawnContent).toHaveBeenCalled()
    })
  })

  describe('when getSpawnContent throw', () => {
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockRejectedValue(new Error('mock'))
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path')
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(getSpawnContent).toHaveBeenCalled()
      }
    })
  })
})
/*
describe('readFile', () => {
  describe('when readfile succeed', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readFile.mockImplementationOnce(() => Promise.resolve({}))
    })
    it('should return the file', async () => {
      // Act
      const file = await readFile('path')

      // Assert
      expect(file).toBeTruthy()
      expect(fs.promises.readFile).toHaveBeenCalled()
    })
  })

  describe('when readfile throw', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readFile.mockImplementationOnce(() => Promise.reject('Error'))
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path')
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(fs.promises.readFile).toHaveBeenCalled()
      }
    })
  })
})
*/
describe('scan', () => {
  describe('when getSpawnContent throw', () => {
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockRejectedValue(new Error('mock'))
    })
    it('should not throw', async () => {
      // Arrange
      const res = await scan('dir', work.config)

      // Assert
      expect(res).toMatchObject({})
    })
  })
  describe('when getSpawnContent returns nothing', () => {
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(Buffer.from(''))
    })
    it('should return nothing', async () => {
      // Arrange
      const g = scan('dir', work.config)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when getSpawnContent returns a file', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(
        Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan(dir, work.config)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toEqual(`${dir}${file}`)
    })
  })
  describe('when getSpawnContent returns an empty directory', () => {
    const dir = 'dir/'
    const subDir = 'subDir/'
    it('should return nothing', async () => {
      // Arrange
      mockedGetStreamContent.mockResolvedValueOnce(
        Buffer.from([`tree HEAD:${dir}`, '', subDir].join(EOL))
      )
      mockedGetStreamContent.mockResolvedValue(
        Buffer.from([`tree HEAD:${dir}${subDir}`].join(EOL))
      )
      const g = scan('dir', work.config)

      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when getSpawnContent returns a directory with a file', () => {
    const dir = 'dir/'
    const subDir = 'subDir/'
    const subFile = 'test.js'
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValueOnce(
        Buffer.from([`tree HEAD:${dir}`, '', subDir].join(EOL))
      )
      mockedGetStreamContent.mockResolvedValue(
        Buffer.from([`tree HEAD:${dir}${subDir}`, '', subFile].join(EOL))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan('dir', work.config)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe(`${dir}${subDir}${subFile}`)
    })
  })
})
describe('scanExtension', () => {
  describe('when directory does not contains a file with the extension', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(
        Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return', async () => {
      // Arrange
      // Act
      const result = await scanExtension(dir, 'txt', work.config)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('when directory contains a file with the extension', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(
        Buffer.from([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return a file', async () => {
      // Arrange
      // Act
      const result = await scanExtension(dir, 'js', work.config)

      // Assert
      expect(result).toEqual([`${dir}${file}`])
    })
  })
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

describe('pathExists', () => {
  it('returns true when path is folder', async () => {
    // Arrange
    mockedGetStreamContent.mockResolvedValue(Buffer.from('tree path\n\nfolder'))

    // Act
    const result = await pathExists('path', work.config)

    // Assert
    expect(result).toBe(true)
  })
  it('returns true when path is file', async () => {
    // Arrange
    mockedGetStreamContent.mockResolvedValue(
      Buffer.from('{"attribute":"content"}')
    )

    // Act
    const result = await pathExists('path', work.config)

    // Assert
    expect(result).toBe(true)
  })
  it('returns false when path does not exist', async () => {
    // Arrange
    mockedGetStreamContent.mockResolvedValue(Buffer.from(''))

    // Act
    const result = await pathExists('path', work.config)

    // Assert
    expect(result).toBe(false)
  })
  it('do not throws when getSpawnContent throws', async () => {
    expect.assertions(1)
    // Arrange
    mockedGetStreamContent.mockRejectedValueOnce(new Error('spawn issue'))

    // Act
    const exist = await pathExists('path', work.config)

    // Assert
    expect(exist).toBe(false)
  })
})

describe('writeFile', () => {
  beforeEach(() => {
    mockedTreatPathSep.mockReturnValue('folder/file')
  })

  it.each(['folder/file', 'folder\\file'])(
    'write the content to the file system',
    async path => {
      // Arrange
      const config: Config = work.config
      config.output = 'root'
      const content = 'content'

      // Act
      await writeFile(path, content, config)

      // Assert
      expect(outputFile).toHaveBeenCalledWith('root/folder/file', content)
    }
  )

  it('call only once for the same path', async () => {
    // Arrange
    const config: Config = work.config
    config.output = 'root'
    const content = 'content'
    const path = 'other/path/file'
    await writeFile(path, content, config)

    // Act
    await writeFile(path, content, config)

    // Assert
    expect(outputFile).toBeCalledTimes(1)
  })
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

describe('isGit', () => {
  it('returns true when it is a git file', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isFile: () => true,
        isDirectory: () => false,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await isGit('test')

    // Assert
    expect(exist).toBe(true)
  })

  it('returns true when it is a git folder', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isFile: () => false,
        isDirectory: () => true,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await isGit('test')

    // Assert
    expect(exist).toBe(true)
  })

  it('returns false when it is neither a git folder nor a git file', async () => {
    // Arrange
    mockedStat.mockImplementation((() =>
      Promise.resolve({
        isFile: () => false,
        isDirectory: () => false,
      } as unknown as Stats)) as unknown as typeof stat)

    // Act
    const exist = await isGit('test')

    // Assert
    expect(exist).toBe(false)
  })
})
