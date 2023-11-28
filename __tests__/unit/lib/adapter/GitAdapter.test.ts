'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getWork } from '../../../__utils__/globalTestHelper'
import { Config } from '../../../../src/types/config'
import GitAdapter from '../../../../src/adapter/GitAdapter'

const mockedDirExists = jest.fn()
const mockedFileExists = jest.fn()
const mockedRaw = jest.fn()
const mockedSetConfig = jest.fn()
const mockedResolvedRef = jest.fn()
const mockedReadObject = jest.fn()

jest.mock('simple-git', () => {
  return {
    simpleGit: jest.fn(() => ({
      raw: mockedRaw,
    })),
  }
})
jest.mock('isomorphic-git', () => ({
  setConfig: function () {
    // eslint-disable-next-line prefer-rest-params
    return mockedSetConfig(...arguments)
  },
  resolveRef: function () {
    // eslint-disable-next-line prefer-rest-params
    return mockedResolvedRef(...arguments)
  },
  readObject: function () {
    // eslint-disable-next-line prefer-rest-params
    return mockedReadObject(...arguments)
  },
}))
jest.mock('../../../../src/utils/fsUtils', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualModule: any = jest.requireActual('../../../../src/utils/fsUtils')

  return {
    ...actualModule,
    dirExists: () => mockedDirExists(),
    fileExists: () => mockedFileExists(),
  }
})

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

  describe('isGit', () => {
    it('should return true when .git folder exists', async () => {
      // Arrange
      mockedDirExists.mockImplementationOnce(() => Promise.resolve(true))
      mockedFileExists.mockImplementationOnce(() => Promise.resolve(false))

      // Act
      const result = await GitAdapter.isGit(config.repo)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when .git file exists', async () => {
      // Arrange
      mockedDirExists.mockImplementationOnce(() => Promise.resolve(false))
      mockedFileExists.mockImplementationOnce(() => Promise.resolve(true))

      // Act
      const result = await GitAdapter.isGit(config.repo)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when .git folder and .git file does not exists', async () => {
      // Arrange
      mockedDirExists.mockImplementationOnce(() => Promise.resolve(false))
      mockedFileExists.mockImplementationOnce(() => Promise.resolve(false))

      // Act
      const result = await GitAdapter.isGit(config.repo)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('configureRepository', () => {
    it('should call setConfig', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      await gitAdapter.configureRepository()

      // Assert
      expect(mockedSetConfig).toBeCalledTimes(1)
      expect(mockedSetConfig).toBeCalledWith(
        expect.objectContaining({
          dir: config.repo,
          path: 'core.quotepath',
          value: 'off',
        })
      )
    })
  })

  describe('parseRev', () => {
    it('should call resolveRef', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedResolvedRef.mockImplementation(() => Promise.resolve('success'))

      // Act
      const result = await gitAdapter.parseRev('ref')

      // Assert
      expect(result).toStrictEqual('success')
      expect(mockedResolvedRef).toBeCalledTimes(1)
      expect(mockedResolvedRef).toBeCalledWith(
        expect.objectContaining({
          dir: config.repo,
          ref: 'ref',
        })
      )
    })
  })

  describe('pathExists', () => {
    describe('when readObject returns a type', () => {
      it.each(['tree', 'blob'])('returns true when type is %s', async type => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedReadObject.mockImplementation(() => Promise.resolve({ type }))

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(true)
        expect(mockedReadObject).toBeCalledTimes(1)
        expect(mockedReadObject).toBeCalledWith(
          expect.objectContaining({
            dir: config.repo,
            oid: config.to,
            filepath: 'path',
          })
        )
      })
      it.each(['test', 'other', null, undefined, -1])(
        'returns false when type is not "blob" nor "tree"',
        async type => {
          // Arrange
          const gitAdapter = GitAdapter.getInstance(config)
          mockedReadObject.mockImplementation(() => Promise.resolve({ type }))

          // Act
          const result = await gitAdapter.pathExists('path')

          // Assert
          expect(result).toBe(false)
          expect(mockedReadObject).toBeCalledTimes(1)
          expect(mockedReadObject).toBeCalledWith(
            expect.objectContaining({
              dir: config.repo,
              oid: config.to,
              filepath: 'path',
            })
          )
        }
      )
    })
    describe('when readObject throws', () => {
      it('returns false', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedReadObject.mockImplementation(() => Promise.reject())

        // Act
        const result = await gitAdapter.pathExists('path')

        // Assert
        expect(result).toBe(false)
        expect(mockedReadObject).toBeCalledTimes(1)
        expect(mockedReadObject).toBeCalledWith(
          expect.objectContaining({
            dir: config.repo,
            oid: config.to,
            filepath: 'path',
          })
        )
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

  describe('getFilesPath', () => {})

  describe('getFilesFrom', () => {})

  describe('getDiffLines', () => {})

  describe('getStringContent', () => {
    describe('when readBlob returns a blob', () => {
      describe('when blob references a LFS file', () => {
        it('returns content from LFS', async () => {})
      })
      describe('when blob does not reference a LFS file', () => {
        it('return blob as a string', async () => {})
      })
    })
    describe('when readBlob throws exception', () => {
      describe('when error name is NotFoundError', () => {
        it('returns empty content', async () => {})
      })
      describe('when error name is not NotFoundError', () => {
        it('throws the exception', async () => {})
      })
    })
  })
})
