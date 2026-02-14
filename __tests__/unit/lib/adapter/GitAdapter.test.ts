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

const isLFSmocked = jest.mocked(isLFS)
const getLFSObjectContentPathMocked = jest.mocked(getLFSObjectContentPath)
const readFileMocked = jest.mocked(readFile)

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
    describe('when catFile returns a type', () => {
      it.each(['tree', 'blob'])('returns true when type is %s', async type => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedCatFile.mockResolvedValue(type as never)

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(true)
        expect(mockedCatFile).toHaveBeenCalledTimes(1)
        expect(mockedCatFile).toHaveBeenCalledWith(['-t', `${config.to}:path`])
      })
      it.each([
        'test',
        'other',
        null,
        undefined,
        -1,
      ])('returns false when type is not "blob" nor "tree"', async type => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedCatFile.mockImplementation(() => Promise.resolve({ type }))

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(false)
        expect(mockedCatFile).toHaveBeenCalledTimes(1)
        expect(mockedCatFile).toHaveBeenCalledWith(['-t', `${config.to}:path`])
      })
    })
    describe('when called multiple times with the same parameters', () => {
      it('returns cached value', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedCatFile.mockResolvedValue('blob' as never)

        // Act
        const result = await gitAdapter.pathExists('path')
        const cachedResult = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(true)
        expect(cachedResult).toStrictEqual(result)
        expect(mockedCatFile).toHaveBeenCalledTimes(1)
        expect(mockedCatFile).toHaveBeenCalledWith(['-t', `${config.to}:path`])
      })
    })
    describe('when catFile throws', () => {
      it('returns false', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedCatFile.mockImplementation(() => Promise.reject())

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(false)
        expect(mockedCatFile).toHaveBeenCalledTimes(1)
        expect(mockedCatFile).toHaveBeenCalledWith(['-t', `${config.to}:path`])
      })
    })
    describe('when custom revision is provided', () => {
      it('uses the custom revision in git command', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        const customRevision = 'feature-branch'
        mockedCatFile.mockResolvedValue('blob' as never)

        // Act
        const result = await gitAdapter.pathExists('path', customRevision)

        // Assert
        expect(result).toBe(true)
        expect(mockedCatFile).toHaveBeenCalledWith([
          '-t',
          `${customRevision}:path`,
        ])
      })

      it('caches separately per revision', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedCatFile
          .mockResolvedValueOnce('blob' as never)
          .mockResolvedValueOnce('tree' as never)

        // Act
        const result1 = await gitAdapter.pathExists('path', 'rev1')
        const result2 = await gitAdapter.pathExists('path', 'rev2')
        const cached1 = await gitAdapter.pathExists('path', 'rev1')

        // Assert
        expect(result1).toBe(true)
        expect(result2).toBe(true)
        expect(cached1).toBe(true)
        expect(mockedCatFile).toHaveBeenCalledTimes(2)
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
    it('calls raw', async () => {
      // Arrange
      const source = 'path'
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue('' as never)

      // Act
      await gitAdapter.getFilesPath(source)

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        source,
      ])
    })

    it('when path is empty it calls current directory', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue('' as never)

      // Act
      await gitAdapter.getFilesPath('')

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        '.',
      ])
    })

    it('memoize call', async () => {
      // Arrange
      const source = 'path'
      const gitAdapter = GitAdapter.getInstance(config)
      const rawOutput = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      mockedRaw.mockResolvedValue(rawOutput.join(EOL) as never)

      // Act
      const result = await gitAdapter.getFilesPath(source)
      const cachedResult = await gitAdapter.getFilesPath(source)

      // Assert
      expect(result).toEqual(rawOutput)
      expect(cachedResult).toStrictEqual(result)
      expect(mockedRaw).toHaveBeenCalledTimes(1)
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        source,
      ])
    })

    it('memoize sub call', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const rawOutput = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      mockedRaw.mockResolvedValue(rawOutput.join(EOL) as never)

      // Act
      const result = await gitAdapter.getFilesPath('path')
      const subCachedResult = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual(rawOutput)
      expect(subCachedResult).toEqual(rawOutput.slice(1)) // Only sub-paths
      expect(mockedRaw).toHaveBeenCalledTimes(1)
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        'path',
      ])
    })

    it('handles multiple paths correctly', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const path1Output = ['path1/file1', 'path1/file2']
      const path2Output = ['path2/file1', 'path2/file2']

      mockedRaw
        .mockResolvedValueOnce(path1Output.join(EOL) as never)
        .mockResolvedValueOnce(path2Output.join(EOL) as never)

      // Act
      const result = await gitAdapter.getFilesPath(['path1', 'path2'])

      // Assert
      expect(result).toEqual([...path1Output, ...path2Output])
      expect(mockedRaw).toHaveBeenCalledTimes(2)
      expect(mockedRaw).toHaveBeenNthCalledWith(1, [
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        'path1',
      ])
      expect(mockedRaw).toHaveBeenNthCalledWith(2, [
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        'path2',
      ])
    })

    it('caches results for multiple paths independently', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const path1Output = ['path1/file1', 'path1/file2']
      const path2Output = ['path2/file1', 'path2/file2']

      mockedRaw
        .mockResolvedValueOnce(path1Output.join(EOL) as never)
        .mockResolvedValueOnce(path2Output.join(EOL) as never)

      // Act
      const result1 = await gitAdapter.getFilesPath(['path1', 'path2'])
      const result2 = await gitAdapter.getFilesPath(['path1']) // Should use cache
      const result3 = await gitAdapter.getFilesPath(['path2']) // Should use cache

      // Assert
      expect(result1).toEqual([...path1Output, ...path2Output])
      expect(result2).toEqual(path1Output)
      expect(result3).toEqual(path2Output)
      expect(mockedRaw).toHaveBeenCalledTimes(2) // Only called for initial paths
    })

    it('handles empty array of paths', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      const result = await gitAdapter.getFilesPath([])

      // Assert
      expect(result).toEqual([])
      expect(mockedRaw).not.toHaveBeenCalled()
    })

    it('does not cache parent subpaths', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const rawOutput = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      mockedRaw.mockResolvedValueOnce(rawOutput.slice(1).join(EOL) as never)
      mockedRaw.mockResolvedValue(rawOutput.join(EOL) as never)

      // Act
      const resultAtFilePath = await gitAdapter.getFilesPath('path/to')
      const resultAtPath = await gitAdapter.getFilesPath('path')

      // Assert
      expect(resultAtFilePath).toEqual(rawOutput.slice(1))
      expect(resultAtPath).toEqual(rawOutput)
      expect(mockedRaw).toHaveBeenCalledTimes(2)
    })

    it('uses custom revision in git command', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const customRevision = 'feature-branch'
      mockedRaw.mockResolvedValue('' as never)

      // Act
      await gitAdapter.getFilesPath('path', customRevision)

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        customRevision,
        'path',
      ])
    })

    it('caches separately per revision', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const rev1Output = ['path/file1']
      const rev2Output = ['path/file2']
      mockedRaw
        .mockResolvedValueOnce(rev1Output.join(EOL) as never)
        .mockResolvedValueOnce(rev2Output.join(EOL) as never)

      // Act
      const result1 = await gitAdapter.getFilesPath('path', 'rev1')
      const result2 = await gitAdapter.getFilesPath('path', 'rev2')
      const cached1 = await gitAdapter.getFilesPath('path', 'rev1')

      // Assert
      expect(result1).toEqual(rev1Output)
      expect(result2).toEqual(rev2Output)
      expect(cached1).toEqual(rev1Output)
      expect(mockedRaw).toHaveBeenCalledTimes(2)
    })

    it('memoize sub call with custom revision', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const customRevision = 'feature-branch'
      const rawOutput = ['path/to/file', 'path/to/another/file']
      mockedRaw.mockResolvedValue(rawOutput.join(EOL) as never)

      // Act
      const result = await gitAdapter.getFilesPath('path', customRevision)
      const subCachedResult = await gitAdapter.getFilesPath(
        'path/to',
        customRevision
      )

      // Assert
      expect(result).toEqual(rawOutput)
      expect(subCachedResult).toEqual(rawOutput)
      expect(mockedRaw).toHaveBeenCalledTimes(1)
    })
  })

  describe('getFilesFrom', () => {
    it('returns the list of files', async () => {
      // Arrange
      const content = 'content'
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockImplementation(() =>
        Promise.resolve(['file', 'anotherFile'].join('\n'))
      )
      mockedShowBuffer.mockResolvedValue(Buffer.from(content) as never)

      // Act
      const result: any = []
      for await (const file of gitAdapter.getFilesFrom('directory/path')) {
        result.push(file)
      }

      // Assert

      expect(result).toEqual(
        expect.arrayContaining([
          { path: 'file', content: Buffer.from(content) },
        ])
      )
    })

    describe('when files are LFS', () => {
      it('returns the list of files', async () => {
        // Arrange
        const content = 'content'
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw.mockImplementation(() =>
          Promise.resolve(['file', 'anotherFile'].join('\n'))
        )
        mockedCatFile.mockResolvedValue(Buffer.from(content) as never)

        // Act
        const result: any = []
        for await (const file of gitAdapter.getFilesFrom('directory/path')) {
          result.push(file)
        }

        // Assert

        expect(result).toEqual(
          expect.arrayContaining([
            { path: 'file', content: Buffer.from(content) },
          ])
        )
      })
    })

    describe('when path is not a directory nor a file', () => {
      it('returns empty list', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw.mockResolvedValue('' as never)

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
    it('calls diff name-status', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue(`A\ttest\nM\tfile\nD\tanotherfile` as never)

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual(['A\ttest', 'M\tfile', 'D\tanotherfile'])
      expect(mockedRaw).toHaveBeenCalledTimes(1)
      expect(mockedRaw).toHaveBeenCalledWith(
        expect.arrayContaining(['diff', '--name-status', '--no-renames'])
      )
    })

    describe('when called with ignore white space', () => {
      it('add ignore white space params', async () => {
        // Arrange
        config.ignoreWhitespace = true
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw.mockResolvedValue(`A\ttest\nM\tfile\nD\tanotherfile` as never)

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual(['A\ttest', 'M\tfile', 'D\tanotherfile'])
        expect(mockedRaw).toHaveBeenCalledTimes(1)
        expect(mockedRaw).toHaveBeenCalledWith(
          expect.arrayContaining([
            'diff',
            '--name-status',
            '--no-renames',
            ...IGNORE_WHITESPACE_PARAMS,
          ])
        )
      })
    })
  })

  describe('listDirAtRevision', () => {
    it('Given valid directory and revision, When listDirAtRevision, Then returns file names from the directory', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue(
        ['myDir/file1.txt', 'myDir/file2.cls', ''].join(EOL) as never
      )

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.cls'])
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        'HEAD',
        'myDir/',
      ])
    })

    it('Given empty directory string, When listDirAtRevision, Then calls with current directory', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue('' as never)

      // Act
      await gitAdapter.listDirAtRevision('', 'HEAD')

      // Assert
      expect(mockedRaw).toHaveBeenCalledWith([
        'ls-tree',
        '--name-only',
        'HEAD',
        '.',
      ])
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
  })
})
