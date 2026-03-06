'use strict'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, jest } from '@jest/globals'

import { EOL } from 'os'
import GitAdapter from '../../../../src/adapter/GitAdapter'
import { IGNORE_WHITESPACE_PARAMS } from '../../../../src/constant/gitConstants'
import type { Config } from '../../../../src/types/config'
import {
  getLFSObjectContentPath,
  isLFS,
} from '../../../../src/utils/gitLfsHelper'
import { getWork } from '../../../__utils__/testWork'

const mockedRaw = jest.fn()
const mockedAddConfig = jest.fn()
const mockedRevParse = jest.fn()
const mockedCatFile = jest.fn()
const mockedShowBuffer = jest.fn()

jest.mock('simple-git', () => {
  return {
    simpleGit: jest.fn(() => ({
      raw: mockedRaw,
      revparse: mockedRevParse,
      addConfig: mockedAddConfig,
      catFile: mockedCatFile,
      showBuffer: mockedShowBuffer,
    })),
  }
})

jest.mock('../../../../src/utils/gitLfsHelper')
jest.mock('node:fs/promises')
jest.mock('../../../../src/utils/LoggingService')

const isLFSmocked = jest.mocked(isLFS)
const getLFSObjectContentPathMocked = jest.mocked(getLFSObjectContentPath)
const readFileMocked = jest.mocked(readFile)

// Helper to set up tree index for a revision
const setupTreeIndex = (files: string[]) => {
  mockedRaw.mockResolvedValue(files.join(EOL) as never)
}

describe('GitAdapter', () => {
  let config: Config
  beforeEach(() => {
    const work = getWork()
    config = work.config
  })
  describe('getInstance', () => {
    it('should return an instance of GitAdapter', () => {
      // Arrange

      // Act
      const gitAdapter = GitAdapter.getInstance(config)

      // Assert
      expect(gitAdapter).toBeInstanceOf(GitAdapter)
    })

    it('should return the same instance of GitAdapter', () => {
      // Arrange

      // Act
      const gitAdapter1 = GitAdapter.getInstance(config)
      const gitAdapter2 = GitAdapter.getInstance(config)

      // Assert
      expect(gitAdapter1).toBe(gitAdapter2)
    })

    describe('when different config is passed', () => {
      it('should return different instance of GitAdapter', () => {
        // Arrange

        // Act
        const gitAdapter1 = GitAdapter.getInstance(config)
        const gitAdapter2 = GitAdapter.getInstance({} as Config)

        // Assert
        expect(gitAdapter1).not.toBe(gitAdapter2)
      })
    })
  })

  describe('configureRepository', () => {
    it('should call setConfig', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      await gitAdapter.configureRepository()

      // Assert
      expect(mockedAddConfig).toHaveBeenCalledTimes(2)
      expect(mockedAddConfig).toHaveBeenCalledWith('core.longpaths', 'true')
      expect(mockedAddConfig).toHaveBeenCalledWith('core.quotepath', 'off')
    })
  })

  describe('parseRev', () => {
    it('should call resolveRef', async () => {
      // Arrange
      const expected = 'sha'
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRevParse.mockImplementation(() => Promise.resolve(expected))

      // Act
      const result = await gitAdapter.parseRev('ref')

      // Assert
      expect(result).toStrictEqual(expected)
      expect(mockedRevParse).toHaveBeenCalledTimes(1)
      expect(mockedRevParse).toHaveBeenCalledWith(
        expect.arrayContaining(['ref'])
      )
    })
  })

  describe('pathExists', () => {
    describe('Given file exists in tree index, When pathExists, Then returns true', () => {
      it('returns true for an exact file match', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/to/file.txt', 'other/file.cls'])

        // Act
        const result = await gitAdapter.pathExists('path/to/file.txt')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('Given directory exists in tree index, When pathExists, Then returns true', () => {
      it('returns true for a directory prefix', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/to/file.txt', 'other/file.cls'])

        // Act
        const result = await gitAdapter.pathExists('path/to')

        // Assert
        expect(result).toBe(true)
      })

      it('returns true for a top-level directory', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/to/file.txt'])

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('Given path does not exist in tree index, When pathExists, Then returns false', () => {
      it('returns false for non-existing path', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/to/file.txt'])

        // Act
        const result = await gitAdapter.pathExists('nonexistent')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('Given tree index build fails, When pathExists, Then returns false', () => {
      it('returns false', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw.mockRejectedValue(new Error('git error') as never)

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('Given multiple calls for same revision, When pathExists, Then uses single raw call', () => {
      it('uses the tree index without additional git calls', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/to/file.txt', 'other/file.cls'])

        // Act
        const result1 = await gitAdapter.pathExists('path/to/file.txt')
        const result2 = await gitAdapter.pathExists('other/file.cls')
        const result3 = await gitAdapter.pathExists('nonexistent')

        // Assert
        expect(result1).toBe(true)
        expect(result2).toBe(true)
        expect(result3).toBe(false)
        expect(mockedRaw).toHaveBeenCalledTimes(1)
        expect(mockedRaw).toHaveBeenCalledWith([
          'ls-tree',
          '--name-only',
          '-r',
          config.to,
        ])
      })
    })

    describe('Given custom revision, When pathExists, Then uses custom revision', () => {
      it('uses the custom revision in git command', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        const customRevision = 'feature-branch'
        setupTreeIndex(['path/to/file.txt'])

        // Act
        const result = await gitAdapter.pathExists(
          'path/to/file.txt',
          customRevision
        )

        // Assert
        expect(result).toBe(true)
        expect(mockedRaw).toHaveBeenCalledWith([
          'ls-tree',
          '--name-only',
          '-r',
          customRevision,
        ])
      })
    })

    describe('Given different revisions, When pathExists, Then caches separately per revision', () => {
      it('builds one tree index per revision', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw
          .mockResolvedValueOnce('path/file1.txt' as never)
          .mockResolvedValueOnce('path/file2.txt' as never)

        // Act
        const result1 = await gitAdapter.pathExists('path/file1.txt', 'rev1')
        const result2 = await gitAdapter.pathExists('path/file2.txt', 'rev2')
        const cached1 = await gitAdapter.pathExists('path/file1.txt', 'rev1')

        // Assert
        expect(result1).toBe(true)
        expect(result2).toBe(true)
        expect(cached1).toBe(true)
        expect(mockedRaw).toHaveBeenCalledTimes(2)
      })
    })

    describe('Given pathExists does not use catFile, When pathExists, Then no catFile calls are made', () => {
      it('does not call catFile', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/to/file.txt'])

        // Act
        await gitAdapter.pathExists('path/to/file.txt')

        // Assert
        expect(mockedCatFile).not.toHaveBeenCalled()
      })
    })

    describe('Given partial path match, When pathExists, Then does not false-positive', () => {
      it('does not match partial directory names', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['path/together/file.txt'])

        // Act
        const result = await gitAdapter.pathExists('path/to')

        // Assert
        expect(result).toBe(false)
      })
    })
  })

  describe('getFirstCommitRef', () => {
    it('should return the first commit ref', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const expected = 'firstCommitRef'
      mockedRaw.mockImplementation(() => Promise.resolve(expected))

      // Act
      const result = await gitAdapter.getFirstCommitRef()

      // Assert
      expect(result).toBe(expected)
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStringContent', () => {
    describe('when catFile returns a string', () => {
      describe('when string references a LFS file', () => {
        it('returns content from LFS', async () => {
          // Arrange
          const gitAdapter = GitAdapter.getInstance(config)
          mockedShowBuffer.mockImplementation(() =>
            Promise.resolve('lfs content')
          )
          isLFSmocked.mockReturnValueOnce(true)
          getLFSObjectContentPathMocked.mockReturnValueOnce('lfs/path')
          readFileMocked.mockResolvedValue(Buffer.from('') as never)
          // Act
          const result = await gitAdapter.getStringContent({
            path: '',
            oid: config.to,
          })

          // Assert
          expect(result).toBe('')
          expect(mockedShowBuffer).toHaveBeenCalledWith(`${config.to}:`)
        })
      })
      describe('when string does not reference a LFS file', () => {
        it('return the content', async () => {
          // Arrange
          const expected = 'test'
          const gitAdapter = GitAdapter.getInstance(config)
          mockedShowBuffer.mockImplementation(() => Promise.resolve(expected))
          isLFSmocked.mockReturnValueOnce(false)
          // Act
          const result = await gitAdapter.getStringContent({
            path: '',
            oid: config.to,
          })

          // Assert
          expect(result).toBe(expected)
          expect(mockedShowBuffer).toHaveBeenCalledWith(`${config.to}:`)
        })
      })
    })
    describe('when catFile throws exception', () => {
      it('throws the exception', async () => {
        // Arrange
        expect.assertions(1)
        const gitAdapter = GitAdapter.getInstance(config)
        mockedShowBuffer.mockImplementation(() =>
          Promise.reject(new Error('test'))
        )
        // Act
        try {
          await gitAdapter.getStringContent({
            path: '',
            oid: config.to,
          })
        } catch {
          // Assert
          expect(mockedShowBuffer).toHaveBeenCalledWith(`${config.to}:`)
        }
      })
    })
  })

  describe('getFilesPath', () => {
    it('Given path, When getFilesPath, Then returns matching files from tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
        'other/file',
      ]
      setupTreeIndex(allFiles)

      // Act
      const result = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual([
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ])
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
      ])
    })

    it('Given sub-path, When getFilesPath, Then returns only files under that sub-path', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      setupTreeIndex(allFiles)

      // Act
      const result = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual(['path/to/file', 'path/to/another/file'])
    })

    it('Given exact file path, When getFilesPath, Then returns that file', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      setupTreeIndex(['path/to/file.txt', 'other/file.cls'])

      // Act
      const result = await gitAdapter.getFilesPath('path/to/file.txt')

      // Assert
      expect(result).toEqual(['path/to/file.txt'])
    })

    it('Given multiple calls with same revision, When getFilesPath, Then only one raw call', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      setupTreeIndex(allFiles)

      // Act
      const result = await gitAdapter.getFilesPath('path')
      const cachedResult = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual(allFiles)
      expect(cachedResult).toStrictEqual(result)
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })

    it('Given sub-path call after parent call, When getFilesPath, Then uses same tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      setupTreeIndex(allFiles)

      // Act
      const result = await gitAdapter.getFilesPath('path')
      const subCachedResult = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual(allFiles)
      expect(subCachedResult).toEqual(allFiles.slice(1))
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })

    it('Given multiple paths as array, When getFilesPath, Then returns combined results', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path1/file1',
        'path1/file2',
        'path2/file1',
        'path2/file2',
      ]
      setupTreeIndex(allFiles)

      // Act
      const result = await gitAdapter.getFilesPath(['path1', 'path2'])

      // Assert
      expect(result).toEqual(allFiles)
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })

    it('Given multiple paths as array, When getFilesPath called again, Then uses cached tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path1/file1',
        'path1/file2',
        'path2/file1',
        'path2/file2',
      ]
      setupTreeIndex(allFiles)

      // Act
      const result1 = await gitAdapter.getFilesPath(['path1', 'path2'])
      const result2 = await gitAdapter.getFilesPath(['path1'])
      const result3 = await gitAdapter.getFilesPath(['path2'])

      // Assert
      expect(result1).toEqual(allFiles)
      expect(result2).toEqual(['path1/file1', 'path1/file2'])
      expect(result3).toEqual(['path2/file1', 'path2/file2'])
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })

    it('Given empty array of paths, When getFilesPath, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      const result = await gitAdapter.getFilesPath([])

      // Assert
      expect(result).toEqual([])
      expect(mockedRaw).not.toHaveBeenCalled()
    })

    it('Given custom revision, When getFilesPath, Then uses custom revision for tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const customRevision = 'feature-branch'
      setupTreeIndex(['path/file.txt'])

      // Act
      await gitAdapter.getFilesPath('path', customRevision)

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        customRevision,
      ])
    })

    it('Given different revisions, When getFilesPath, Then builds one tree index per revision', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw
        .mockResolvedValueOnce('path/file1' as never)
        .mockResolvedValueOnce('path/file2' as never)

      // Act
      const result1 = await gitAdapter.getFilesPath('path', 'rev1')
      const result2 = await gitAdapter.getFilesPath('path', 'rev2')
      const cached1 = await gitAdapter.getFilesPath('path', 'rev1')

      // Assert
      expect(result1).toEqual(['path/file1'])
      expect(result2).toEqual(['path/file2'])
      expect(cached1).toEqual(['path/file1'])
      expect(mockedRaw).toHaveBeenCalledTimes(2)
    })

    it('Given sub-path call with custom revision, When getFilesPath, Then uses same tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const customRevision = 'feature-branch'
      const allFiles = ['path/to/file', 'path/to/another/file']
      setupTreeIndex(allFiles)

      // Act
      const result = await gitAdapter.getFilesPath('path', customRevision)
      const subCachedResult = await gitAdapter.getFilesPath(
        'path/to',
        customRevision
      )

      // Assert
      expect(result).toEqual(allFiles)
      expect(subCachedResult).toEqual(allFiles)
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })

    it('Given path not in tree, When getFilesPath, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      setupTreeIndex(['other/file.txt'])

      // Act
      const result = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual([])
    })

    it('Given partial directory name match, When getFilesPath, Then does not false-positive', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      setupTreeIndex(['path/together/file.txt'])

      // Act
      const result = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('getFilesFrom', () => {
    it('returns the list of files', async () => {
      // Arrange
      const content = 'content'
      const gitAdapter = GitAdapter.getInstance(config)
      setupTreeIndex(['directory/path/file', 'directory/path/anotherFile'])
      mockedShowBuffer.mockResolvedValue(Buffer.from(content) as never)

      // Act
      const result: any = []
      for await (const file of gitAdapter.getFilesFrom('directory/path')) {
        result.push(file)
      }

      // Assert

      expect(result).toEqual(
        expect.arrayContaining([
          {
            path: 'directory/path/file',
            content: Buffer.from(content),
          },
        ])
      )
    })

    describe('when files are LFS', () => {
      it('returns the list of files', async () => {
        // Arrange
        const content = 'content'
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex(['directory/path/file', 'directory/path/anotherFile'])
        mockedCatFile.mockResolvedValue(Buffer.from(content) as never)

        // Act
        const result: any = []
        for await (const file of gitAdapter.getFilesFrom('directory/path')) {
          result.push(file)
        }

        // Assert

        expect(result).toEqual(
          expect.arrayContaining([
            {
              path: 'directory/path/file',
              content: Buffer.from(content),
            },
          ])
        )
      })
    })

    describe('when path is not a directory nor a file', () => {
      it('returns empty list', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        setupTreeIndex([])

        // Act

        const result: any = []
        for await (const file of gitAdapter.getFilesFrom('directory/path')) {
          result.push(file)
        }

        expect(result).toEqual([])
      })
    })
  })

  describe('getDiffLines', () => {
    it('Given diff output, When getDiffLines, Then calls numstat for each change type and transforms output', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw
        .mockResolvedValueOnce('8\t0\ttest' as never)
        .mockResolvedValueOnce('3\t2\tfile' as never)
        .mockResolvedValueOnce('0\t5\tanotherfile' as never)

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual(['A\ttest', 'M\tfile', 'D\tanotherfile'])
      expect(mockedRaw).toHaveBeenCalledTimes(3)
      expect(mockedRaw).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([
          'diff',
          '--numstat',
          '--no-renames',
          '--diff-filter=A',
        ])
      )
      expect(mockedRaw).toHaveBeenNthCalledWith(
        2,
        expect.arrayContaining([
          'diff',
          '--numstat',
          '--no-renames',
          '--diff-filter=M',
        ])
      )
      expect(mockedRaw).toHaveBeenNthCalledWith(
        3,
        expect.arrayContaining([
          'diff',
          '--numstat',
          '--no-renames',
          '--diff-filter=D',
        ])
      )
    })

    it('Given empty diff output, When getDiffLines, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw
        .mockResolvedValueOnce('' as never)
        .mockResolvedValueOnce('' as never)
        .mockResolvedValueOnce('' as never)

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual([])
      expect(mockedRaw).toHaveBeenCalledTimes(3)
    })

    it('Given multiple files per change type, When getDiffLines, Then concatenates all results', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw
        .mockResolvedValueOnce('10\t0\tnewFile1\n5\t0\tnewFile2' as never)
        .mockResolvedValueOnce('3\t2\tmodFile1' as never)
        .mockResolvedValueOnce('0\t8\tdelFile1\n0\t3\tdelFile2' as never)

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual([
        'A\tnewFile1',
        'A\tnewFile2',
        'M\tmodFile1',
        'D\tdelFile1',
        'D\tdelFile2',
      ])
    })

    describe('Given ignoreWhitespace is enabled', () => {
      it('When getDiffLines, Then adds whitespace params to each call', async () => {
        // Arrange
        config.ignoreWhitespace = true
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw
          .mockResolvedValueOnce('8\t0\ttest' as never)
          .mockResolvedValueOnce('3\t2\tfile' as never)
          .mockResolvedValueOnce('' as never)

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual(['A\ttest', 'M\tfile'])
        expect(mockedRaw).toHaveBeenCalledTimes(3)
        for (let i = 1; i <= 3; i++) {
          expect(mockedRaw).toHaveBeenNthCalledWith(
            i,
            expect.arrayContaining([...IGNORE_WHITESPACE_PARAMS])
          )
        }
      })
    })

    it('Given binary files in diff, When getDiffLines, Then handles dash stats correctly', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw
        .mockResolvedValueOnce('-\t-\tbinaryFile.png' as never)
        .mockResolvedValueOnce('' as never)
        .mockResolvedValueOnce('' as never)

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual(['A\tbinaryFile.png'])
    })
  })

  describe('listDirAtRevision', () => {
    it('Given valid directory and revision, When listDirAtRevision, Then returns immediate children', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue(
        [
          'myDir/file1.txt',
          'myDir/file2.cls',
          'myDir/subDir/nested.txt',
          'other/file.txt',
        ].join(EOL) as never
      )

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.cls', 'subDir'])
    })

    it('Given directory with nested files only, When listDirAtRevision, Then returns unique immediate children', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue(
        [
          'myDir/subDir/file1.txt',
          'myDir/subDir/file2.txt',
          'myDir/otherDir/file3.txt',
        ].join(EOL) as never
      )

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual(['subDir', 'otherDir'])
    })

    it('Given tree index already built for revision, When listDirAtRevision, Then no additional raw calls', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const revision = 'HEAD'
      mockedRaw.mockResolvedValue(
        ['myDir/file1.txt', 'myDir/file2.cls'].join(EOL) as never
      )

      // Act
      await gitAdapter.getFilesPath('myDir', revision)
      mockedRaw.mockClear()
      const result = await gitAdapter.listDirAtRevision('myDir', revision)

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.cls'])
      expect(mockedRaw).not.toHaveBeenCalled()
    })

    it('Given directory does not exist in tree, When listDirAtRevision, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue('other/file.txt' as never)

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('Given git command throws, When listDirAtRevision, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockRejectedValue(new Error('git error') as never)

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('Given listDirAtRevision uses tree index, When called, Then calls ls-tree with correct args', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue('myDir/file1.txt' as never)

      // Act
      await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        'HEAD',
      ])
    })
  })

  describe('gitGrep', () => {
    it('Given matching pattern, When gitGrep, Then returns matching file paths', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const grepOutput = [
        `${config.to}:force-app/fields/Account.field`,
        `${config.to}:force-app/fields/Contact.field`,
        '',
      ].join(EOL)
      mockedRaw.mockResolvedValue(grepOutput as never)

      // Act
      const result = await gitAdapter.gitGrep(
        'MasterDetail',
        'force-app/fields'
      )

      // Assert
      expect(result).toEqual([
        'force-app/fields/Account.field',
        'force-app/fields/Contact.field',
      ])
      expect(mockedRaw).toHaveBeenCalledWith([
        'grep',
        '-l',
        'MasterDetail',
        config.to,
        '--',
        'force-app/fields',
      ])
    })

    it('Given custom revision, When gitGrep, Then uses the custom revision', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const customRevision = 'feature-branch'
      mockedRaw.mockResolvedValue(
        `${customRevision}:force-app/file.xml` as never
      )

      // Act
      const result = await gitAdapter.gitGrep(
        'pattern',
        'force-app',
        customRevision
      )

      // Assert
      expect(result).toEqual(['force-app/file.xml'])
      expect(mockedRaw).toHaveBeenCalledWith([
        'grep',
        '-l',
        'pattern',
        customRevision,
        '--',
        'force-app',
      ])
    })

    it('Given no matches, When gitGrep throws, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockRejectedValue(new Error('no matches') as never)

      // Act
      const result = await gitAdapter.gitGrep('nonexistent', 'force-app/fields')

      // Assert
      expect(result).toEqual([])
    })
  })
})
