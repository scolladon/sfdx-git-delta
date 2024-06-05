'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { outputFile } from 'fs-extra'

import type { Config } from '../../../../src/types/config'
import type { Work } from '../../../../src/types/work'
import {
  copyFiles,
  pathExists,
  readDir,
  readPathFromGit,
  writeFile,
} from '../../../../src/utils/fsHelper'
import { IgnoreHelper } from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/globalTestHelper'

jest.mock('fs-extra')

const mockKeep = jest.fn()

const mockGetStringContent = jest.fn()
const mockGetFilesFrom = jest.fn()
const mockGetFilesPath = jest.fn()
const mockPathExists = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => ({
  getInstance: () => ({
    getStringContent: mockGetStringContent,
    getFilesFrom: mockGetFilesFrom,
    getFilesPath: mockGetFilesPath,
    pathExists: mockPathExists,
  }),
}))

let work: Work
beforeEach(() => {
  jest.resetAllMocks()
  work = getWork()
  work.config.from = 'pastsha'
  work.config.to = 'recentsha'
  jest.spyOn(IgnoreHelper, 'getIgnoreInstance').mockImplementation(
    () =>
      ({
        keep: mockKeep,
      }) as never
  )
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
})

describe('copyFile', () => {
  beforeEach(() => {
    mockKeep.mockReturnValue(true)
  })
  describe('when file is already copied', () => {
    it('should not copy file', async () => {
      await copyFiles(work.config, 'source/file')
      jest.resetAllMocks()

      // Act
      await copyFiles(work.config, 'source/file')

      // Assert
      expect(mockGetStringContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
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
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is empty', () => {
    it('should copy file', async () => {
      // Arrange
      const sourcePath = 'source/copyFile'
      mockGetFilesFrom.mockImplementation(() =>
        Promise.resolve([
          {
            path: sourcePath,
            content: Buffer.from(''),
          },
        ])
      )

      // Act
      await copyFiles(work.config, sourcePath)

      // Assert
      expect(mockGetFilesFrom).toBeCalled()
      expect(outputFile).toBeCalledWith(`output/${sourcePath}`, Buffer.from(''))
    })
  })

  describe('when path is ignored', () => {
    it('should not copy this path', async () => {
      // Arrange
      mockKeep.mockReturnValue(false)

      // Act
      await copyFiles(work.config, 'source/ignored')

      // Assert
      expect(mockGetFilesFrom).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when content should be copied', () => {
    describe('when source location is empty', () => {
      it('should copy file', async () => {
        // Arrange
        mockGetFilesFrom.mockImplementation(() =>
          Promise.resolve([
            {
              path: 'source/emptyFile',
              content: Buffer.from(''),
            },
          ])
        )

        // Act
        await copyFiles(work.config, 'source/emptyFile')

        // Assert
        expect(mockGetFilesFrom).toBeCalled()
        expect(outputFile).toBeCalledWith(
          'output/source/emptyFile',
          Buffer.from('')
        )
      })
    })

    describe('when source location is not empty', () => {
      describe('when content is a folder', () => {
        it('should copy the folder', async () => {
          // Arrange
          mockGetFilesFrom.mockImplementation(() =>
            Promise.resolve([
              {
                path: 'copyDir/copyFile',
                content: Buffer.from('content'),
              },
            ])
          )

          // Act
          await copyFiles(work.config, 'source/copyDir')

          // Assert
          expect(mockGetFilesFrom).toBeCalledTimes(1)
          expect(outputFile).toBeCalledTimes(1)
          expect(outputFile).toHaveBeenCalledWith(
            'output/copyDir/copyFile',
            Buffer.from('content')
          )
        })
      })

      describe('when content is not a git location', () => {
        it('should ignore this path', async () => {
          // Arrange
          const sourcePath = 'source/warning'
          mockGetFilesFrom.mockImplementation(() => Promise.reject())

          // Act
          await copyFiles(work.config, sourcePath)

          // Assert
          expect(mockGetFilesFrom).toBeCalled()
          expect(outputFile).not.toBeCalled()
        })
      })
      describe('when content is a file', () => {
        beforeEach(async () => {
          // Arrange
          mockGetFilesFrom.mockImplementation(() =>
            Promise.resolve([
              { path: 'source/copyFile', content: Buffer.from('content') },
            ])
          )
        })
        it('should copy the file', async () => {
          // Act
          await copyFiles(work.config, 'source/copyfile')

          // Assert
          expect(mockGetFilesFrom).toBeCalled()
          expect(outputFile).toBeCalledTimes(1)
          expect(outputFile).toHaveBeenCalledWith(
            'output/source/copyFile',
            Buffer.from('content')
          )
        })
      })
    })
  })
})

describe('readDir', () => {
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
      const dirContent = await readDir(dir, work.config)

      // Assert
      expect(dirContent).toEqual(expect.arrayContaining([`${dir}${file}`]))
      expect(mockGetFilesPath).toHaveBeenCalled()
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
        await readDir('path', work.config)
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
    const result = await pathExists('path', work.config)

    // Assert
    expect(result).toBe(false)
  })
  it('returns false when sub service throws', async () => {
    expect.assertions(1)
    // Arrange
    mockPathExists.mockImplementation(() => Promise.reject(new Error('test')))

    // Act
    const exist = await pathExists('path', work.config)

    // Assert
    expect(exist).toBe(false)
  })
})

describe('writeFile', () => {
  beforeEach(() => {
    mockKeep.mockReturnValue(true)
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
    mockKeep.mockReturnValue(false)

    // Act
    await writeFile('', '', {} as Config)

    // Assert
    expect(outputFile).not.toBeCalled()
  })
})
