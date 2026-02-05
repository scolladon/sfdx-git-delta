'use strict'
import { describe, expect, it, jest } from '@jest/globals'
import { outputFile } from 'fs-extra'
import { Ignore } from 'ignore'

import type { Config } from '../../../../src/types/config'
import type { Work } from '../../../../src/types/work'
import {
  copyFiles,
  pathExists,
  readDirs,
  readPathFromGit,
  writeFile,
} from '../../../../src/utils/fsHelper'
import {
  buildIgnoreHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/globalTestHelper'

jest.mock('fs-extra')

jest.mock('../../../../src/utils/ignoreHelper')

const mockBuildIgnoreHelper = jest.mocked(buildIgnoreHelper)

const mockGetStringContent = jest.fn()
const mockGetFilesFrom = jest.fn()
const mockGetFilesPath = jest.fn()
const mockPathExists = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: () => ({
        getStringContent: mockGetStringContent,
        getFilesFrom: mockGetFilesFrom,
        getFilesPath: mockGetFilesPath,
        pathExists: mockPathExists,
      }),
    },
  }
})

let work: Work
beforeEach(() => {
  jest.resetAllMocks()
  work = getWork()
  work.config.from = 'pastsha'
  work.config.to = 'recentsha'
})

describe('readPathFromGit', () => {
  describe.each([
    ['windows', 'force-app\\main\\default\\classes\\myClass.cls'],
    ['unix', 'force-app/main/default/classes/myClass.cls'],
  ])('when path is %s format', (_, path) => {
    beforeEach(() => {
      // Arrange
      mockGetStringContent.mockImplementation(() =>
        Promise.resolve(Buffer.from(''))
      )
    })

    it('returns the file content at `config.to` ref', async () => {
      // Act
      const forRef = { path, oid: work.config.to }
      await readPathFromGit(forRef, work.config)

      // Assert
      expect(mockGetStringContent).toHaveBeenCalledWith(forRef)
    })
  })

  describe.each([undefined, null])('when path contains "%s"', value => {
    beforeEach(() => {
      // Arrange
      mockGetStringContent.mockImplementation(() => Promise.resolve(value))
    })

    it('returns the file content at `config.to` ref', async () => {
      // Act
      const content = await readPathFromGit(
        { path: 'path/file', oid: work.config.to },
        work.config
      )

      // Assert
      expect(content).toBe(value)
    })
  })

  describe('when git adapter throws an error', () => {
    beforeEach(() => {
      // Arrange
      mockGetStringContent.mockImplementation(() =>
        Promise.reject(new Error('git error'))
      )
    })

    it('returns empty string and logs the error', async () => {
      // Act
      const content = await readPathFromGit(
        { path: 'path/file', oid: work.config.to },
        work.config
      )

      // Assert
      expect(content).toBe('')
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
      expect(mockGetStringContent).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('when file is already written', () => {
    it('should not copy file', async () => {
      // Arrange
      await writeFile('source/file', 'content', work.config)
      jest.resetAllMocks()

      // Act
      await copyFiles(work.config, 'source/file')

      // Assert
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('when source location is empty', () => {
    it('should copy file', async () => {
      // Arrange
      const sourcePath = 'source/copyFile'
      mockGetFilesFrom.mockImplementation(async function* () {
        yield await {
          path: sourcePath,
          content: Buffer.from(''),
        }
      })

      // Act
      await copyFiles(work.config, sourcePath)

      // Assert
      expect(mockGetFilesFrom).toHaveBeenCalled()
      expect(outputFile).toHaveBeenCalledWith(
        `output/${sourcePath}`,
        Buffer.from('')
      )
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
      expect(mockGetFilesFrom).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('when content should be copied', () => {
    describe('when source location is empty', () => {
      it('should copy file', async () => {
        // Arrange
        mockGetFilesFrom.mockImplementation(async function* () {
          yield await {
            path: 'source/emptyFile',
            content: Buffer.from(''),
          }
          yield await {
            path: 'source/anotherEmptyFile',
            content: Buffer.from(''),
          }
        })

        // Act
        await copyFiles(work.config, 'source/emptyFile')

        // Assert
        expect(mockGetFilesFrom).toHaveBeenCalled()
        expect(outputFile).toHaveBeenCalledTimes(2)
        expect(outputFile).toHaveBeenCalledWith(
          'output/source/emptyFile',
          Buffer.from('')
        )
        expect(outputFile).toHaveBeenCalledWith(
          'output/source/anotherEmptyFile',
          Buffer.from('')
        )
      })
    })

    describe('when source location is not empty', () => {
      describe('when content is a folder', () => {
        it('should copy the folder', async () => {
          // Arrange
          mockGetFilesFrom.mockImplementation(async function* () {
            yield await {
              path: 'copyDir/copyFile',
              content: Buffer.from('content'),
            }
          })

          // Act
          await copyFiles(work.config, 'source/copyDir')

          // Assert
          expect(mockGetFilesFrom).toHaveBeenCalledTimes(1)
          expect(outputFile).toHaveBeenCalledTimes(1)
          expect(outputFile).toHaveBeenCalledWith(
            'output/copyDir/copyFile',
            Buffer.from('content')
          )
        })
      })

      describe('when content is not a git location', () => {
        it('should ignore this path', async () => {
          // Arrange
          mockGetFilesFrom.mockImplementation(async function* () {})

          // Act
          await copyFiles(work.config, 'source/warning')

          // Assert
          expect(mockGetFilesFrom).toHaveBeenCalled()
          expect(outputFile).not.toHaveBeenCalled()
        })
      })
      describe('when content is a file', () => {
        beforeEach(async () => {
          // Arrange
          mockGetFilesFrom.mockImplementation(async function* () {
            yield await {
              path: 'source/copyFile',
              content: Buffer.from('content'),
            }
          })
        })
        it('should copy the file', async () => {
          // Act
          await copyFiles(work.config, 'source/copyfile')

          // Assert
          expect(mockGetFilesFrom).toHaveBeenCalled()
          expect(outputFile).toHaveBeenCalledTimes(1)
          expect(outputFile).toHaveBeenCalledWith(
            'output/source/copyFile',
            Buffer.from('content')
          )
        })
      })
    })
  })
})

describe('readDirs', () => {
  describe('when path exist', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      mockGetFilesPath.mockImplementation(() =>
        Promise.resolve([`${dir}${file}`])
      )
    })
    it('should return the file', async () => {
      // Act
      const dirContent = await readDirs(dir, work.config)

      // Assert
      expect(dirContent).toEqual(expect.arrayContaining([`${dir}${file}`]))
      expect(mockGetFilesPath).toHaveBeenCalled()
    })

    it('should work with an array of paths', async () => {
      // Arrange
      const paths = ['dir1/', 'dir2/']
      mockGetFilesPath.mockImplementation(() =>
        Promise.resolve(['dir1/file1.js', 'dir2/file2.js'])
      )

      // Act
      const dirContent = await readDirs(paths, work.config)

      // Assert
      expect(dirContent).toEqual(
        expect.arrayContaining(['dir1/file1.js', 'dir2/file2.js'])
      )
      expect(mockGetFilesPath).toHaveBeenCalledWith(paths)
    })
  })

  describe('when path does not exist', () => {
    beforeEach(() => {
      // Arrange
      mockGetFilesPath.mockImplementation(() =>
        Promise.reject(new Error('test'))
      )
    })
    it('should throw', async () => {
      // Act
      try {
        await readDirs('path', work.config)
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(mockGetFilesPath).toHaveBeenCalled()
      }
    })
  })
})

describe('pathExists', () => {
  it('returns true when path is folder', async () => {
    // Arrange
    mockPathExists.mockImplementation(() => Promise.resolve(true))

    // Act
    const result = await pathExists('path', work.config)

    // Assert
    expect(result).toBe(true)
  })
  it('returns true when path is file', async () => {
    // Arrange
    mockPathExists.mockImplementation(() => Promise.resolve(true))

    // Act
    const result = await pathExists('path', work.config)

    // Assert
    expect(result).toBe(true)
  })
  it('returns false when path does not exist', async () => {
    // Arrange
    mockPathExists.mockImplementation(() => Promise.resolve(false))

    // Act
    const result = await pathExists('not/existing/path', work.config)

    // Assert
    expect(result).toBe(false)
  })
})

describe('writeFile', () => {
  beforeEach(() => {
    mockBuildIgnoreHelper.mockResolvedValue({
      globalIgnore: {
        ignores: () => false,
      } as unknown as Ignore,
    } as unknown as IgnoreHelper)
  })
  it('write the content to the file system', async () => {
    // Arrange
    const path = 'folder/file'
    const config: Config = work.config
    config.output = 'root'
    const content = 'content'

    // Act
    await writeFile(path, content, config)

    // Assert
    expect(outputFile).toHaveBeenCalledWith('root/folder/file', content)
  })

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
    expect(outputFile).toHaveBeenCalledTimes(1)
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
    expect(outputFile).not.toHaveBeenCalled()
  })
})
