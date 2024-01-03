'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getWork } from '../../../__utils__/globalTestHelper'
import {
  copyFiles,
  gitPathSeparatorNormalizer,
  isGit,
  pathExists,
  readDir,
  readPathFromGit,
  scan,
  scanExtension,
  writeFile,
} from '../../../../src/utils/fsHelper'
import {
  IgnoreHelper,
  buildIgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import {
  getSpawnContent,
  treatPathSep,
} from '../../../../src/utils/childProcessUtils'
import { readFile as fsReadFile, Stats, outputFile, stat } from 'fs-extra'
import {
  isLFS,
  getLFSObjectContentPath,
} from '../../../../src/utils/gitLfsHelper'
import { EOL } from 'os'
import { Work } from '../../../../src/types/work'
import { Config } from '../../../../src/types/config'
import { Ignore } from 'ignore'

jest.mock('fs-extra')
jest.mock('../../../../src/utils/gitLfsHelper')
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
jest.mock('../../../../src/utils/ignoreHelper')

const mockBuildIgnoreHelper = jest.mocked(buildIgnoreHelper)
const mockedGetStreamContent = jest.mocked(getSpawnContent)
const mockedTreatPathSep = jest.mocked(treatPathSep)
const mockedStat = jest.mocked(stat)
const mockedIsLFS = jest.mocked(isLFS)
const mockedGetLFSObjectContentPath = jest.mocked(getLFSObjectContentPath)

let work: Work
beforeEach(() => {
  jest.resetAllMocks()
  work = getWork()
  work.config.from = 'pastsha'
  work.config.to = 'recentsha'
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
  describe('when file is LSF', () => {
    const bufferContent =
      Buffer.from(`version https://git-lfs.github.com/spec/v1
    oid sha256:0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14
    size 72`)
    beforeEach(async () => {
      // Arrange
      mockedGetStreamContent.mockResolvedValue(bufferContent)
      mockedIsLFS.mockReturnValueOnce(true)
      mockedGetLFSObjectContentPath.mockImplementationOnce(
        () => 'lfs/objects/oid'
      )
    })
    it('should copy the file', async () => {
      // Act
      await readPathFromGit('path/lfs/file', work.config)

      // Assert
      expect(getSpawnContent).toBeCalled()
      expect(getLFSObjectContentPath).toBeCalledTimes(1)
      expect(getLFSObjectContentPath).toHaveBeenCalledWith(bufferContent)
      expect(fsReadFile).toBeCalledWith('lfs/objects/oid')
    })
  })
})

describe('copyFile', () => {
  beforeEach(() => {
    mockBuildIgnoreHelper.mockResolvedValue({
      globalIgnore: {
        ignores: () => false,
      } as unknown as Ignore,
    } as unknown as IgnoreHelper)
  })
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

  describe('when path is ignored', () => {
    it('should not copy this path', async () => {
      // Arrange
      mockBuildIgnoreHelper.mockResolvedValue({
        globalIgnore: {
          ignores: () => true,
        } as unknown as Ignore,
      } as unknown as IgnoreHelper)

      // Act
      await copyFiles(work.config, 'source/ignored')

      // Assert
      expect(getSpawnContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when content should be copied', () => {
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

    describe('when content is a file', () => {
      beforeEach(async () => {
        // Arrange
        mockedGetStreamContent.mockResolvedValue(Buffer.from('content'))
        mockedTreatPathSep.mockReturnValueOnce('source/copyFile')
        mockedIsLFS.mockReturnValue(false)
      })
      it('should copy the file', async () => {
        // Act
        await copyFiles(work.config, 'source/copyfile')

        // Assert
        expect(getSpawnContent).toBeCalled()
        expect(treatPathSep).toBeCalledTimes(1)
        expect(outputFile).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          'output/source/copyFile',
          Buffer.from('content')
        )
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
        await readDir('path', work.config)
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(getSpawnContent).toHaveBeenCalled()
      }
    })
  })
})

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
    mockBuildIgnoreHelper.mockResolvedValue({
      globalIgnore: {
        ignores: () => false,
      } as unknown as Ignore,
    } as unknown as IgnoreHelper)
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

  it('should not copy ignored path', async () => {
    // Arrange
    mockBuildIgnoreHelper.mockResolvedValue({
      globalIgnore: {
        ignores: () => true,
      } as unknown as Ignore,
    } as unknown as IgnoreHelper)

    // Act
    await writeFile('', '', {} as Config)

    // Assert
    expect(outputFile).not.toBeCalled()
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
