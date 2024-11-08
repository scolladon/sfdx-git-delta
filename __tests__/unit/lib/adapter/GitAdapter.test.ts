'use strict'
import { describe, expect, it, jest } from '@jest/globals'
import { readFile } from 'fs-extra'

import GitAdapter from '../../../../src/adapter/GitAdapter'
import { IGNORE_WHITESPACE_PARAMS } from '../../../../src/constant/gitConstants'
import type { Config } from '../../../../src/types/config'
import {
  getLFSObjectContentPath,
  isLFS,
} from '../../../../src/utils/gitLfsHelper'
import { getWork } from '../../../__utils__/globalTestHelper'

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
jest.mock('fs-extra')

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
      expect(mockedAddConfig).toBeCalledTimes(2)
      expect(mockedAddConfig).toBeCalledWith('core.longpaths', 'true')
      expect(mockedAddConfig).toBeCalledWith('core.quotepath', 'off')
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
      expect(mockedRevParse).toBeCalledTimes(1)
      expect(mockedRevParse).toBeCalledWith(expect.arrayContaining(['ref']))
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
        expect(mockedCatFile).toBeCalledTimes(1)
        expect(mockedCatFile).toBeCalledWith(['-t', `${config.to}:path`])
      })
      it.each(['test', 'other', null, undefined, -1])(
        'returns false when type is not "blob" nor "tree"',
        async type => {
          // Arrange
          const gitAdapter = GitAdapter.getInstance(config)
          mockedCatFile.mockImplementation(() => Promise.resolve({ type }))

          // Act
          const result = await gitAdapter.pathExists('path')

          // Assert
          expect(result).toBe(false)
          expect(mockedCatFile).toBeCalledTimes(1)
          expect(mockedCatFile).toBeCalledWith(['-t', `${config.to}:path`])
        }
      )
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
        expect(mockedCatFile).toBeCalledTimes(1)
        expect(mockedCatFile).toBeCalledWith(['-t', `${config.to}:path`])
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
      expect(mockedRaw).toBeCalledTimes(1)
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
          expect(mockedShowBuffer).toBeCalledWith(`${config.to}:`)
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
          expect(mockedShowBuffer).toBeCalledWith(`${config.to}:`)
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
          expect(mockedShowBuffer).toBeCalledWith(`${config.to}:`)
        }
      })
    })
  })

  describe('getFilesPath', () => {
    it('calls raw', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      await gitAdapter.getFilesPath(config.source)

      // Assert
      expect(mockedRaw).toBeCalledWith([
        'ls-tree',
        '--name-only',
        '-r',
        config.to,
        config.source,
      ])
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
    it('calls diff numstats', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValue(
        `1\t11\ttest\n1\t11\tfile\n1\t1\tanotherfile` as never
      )

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result.length).toBe(9)
      expect(mockedRaw).toBeCalledTimes(3)
      expect(mockedRaw).toBeCalledWith(
        expect.arrayContaining(['diff', '--numstat', '--no-renames'])
      )
    })

    describe('when called with ignore white space', () => {
      it('add ignore white space params', async () => {
        // Arrange
        config.ignoreWhitespace = true
        const gitAdapter = GitAdapter.getInstance(config)
        mockedRaw.mockResolvedValue(
          `1\t11\ttest\n1\t11\tfile\n1\t1\tanotherfile` as never
        )

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result.length).toBe(9)
        expect(mockedRaw).toBeCalledTimes(3)
        expect(mockedRaw).toBeCalledWith(
          expect.arrayContaining([
            'diff',
            '--numstat',
            '--no-renames',
            ...IGNORE_WHITESPACE_PARAMS,
          ])
        )
      })
    })
  })
})
