'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getWork } from '../../../__utils__/globalTestHelper'
import { Config } from '../../../../src/types/config'
import GitAdapter, {
  contentWalker,
  diffLineWalker,
  filePathWalker,
} from '../../../../src/adapter/GitAdapter'
import {
  getLFSObjectContentPath,
  isLFS,
} from '../../../../src/utils/gitLfsHelper'
import { readFile } from 'fs-extra'
import { WalkerEntry } from 'isomorphic-git'

const mockedDirExists = jest.fn()
const mockedFileExists = jest.fn()
const mockedRaw = jest.fn()
const mockedSetConfig = jest.fn()
const mockedResolvedRef = jest.fn()
const mockedReadObject = jest.fn()
const mockedReadBlob = jest.fn()
const mockedWalk = jest.fn()

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
  readBlob: function () {
    // eslint-disable-next-line prefer-rest-params
    return mockedReadBlob(...arguments)
  },
  walk: function () {
    // eslint-disable-next-line prefer-rest-params
    return mockedWalk(...arguments)
  },
  TREE: jest.fn(),
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

  describe('setGitDir', () => {
    it('should set gitdir with git repository', async () => {
      // Arrange
      mockedDirExists.mockImplementation(() => Promise.resolve(true))
      mockedFileExists.mockImplementation(() => Promise.resolve(false))
      const gitAdapter = GitAdapter.getInstance({
        ...config,
        repo: 'repository',
      })

      // Act
      await gitAdapter.setGitDir()

      // Assert
      expect(mockedDirExists).toBeCalledTimes(1)
      expect(mockedFileExists).not.toBeCalled()
    })

    it('should set gitdir with submodules', async () => {
      // Arrange
      mockedDirExists.mockImplementation(() => Promise.resolve(false))
      mockedFileExists.mockImplementation(() => Promise.resolve(true))
      readFileMocked.mockResolvedValue(Buffer.from('content') as never)
      const gitAdapter = GitAdapter.getInstance({
        ...config,
        repo: 'submodule',
      })

      // Act
      await gitAdapter.setGitDir()

      // Assert
      expect(mockedDirExists).toBeCalledTimes(1)
      expect(mockedFileExists).toBeCalledTimes(1)
    })

    it('should throw when no git material is found', async () => {
      // Arrange
      expect.assertions(1)
      mockedDirExists.mockImplementation(() => Promise.resolve(false))
      mockedFileExists.mockImplementation(() => Promise.resolve(false))
      const gitAdapter = GitAdapter.getInstance({
        ...config,
        repo: 'not git material',
      })

      // Act
      try {
        await gitAdapter.setGitDir()
      } catch (error) {
        // Assert
        expect(error).toBeDefined()
      }
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

  describe('getStringContent', () => {
    describe('when readBlob returns a blob', () => {
      describe('when blob references a LFS file', () => {
        it('returns content from LFS', async () => {
          // Arrange
          const gitAdapter = GitAdapter.getInstance(config)
          mockedReadBlob.mockImplementation(() =>
            Promise.resolve({ blob: Buffer.from('test') })
          )
          isLFSmocked.mockReturnValueOnce(true)
          getLFSObjectContentPathMocked.mockReturnValueOnce('lfs/path')
          readFileMocked.mockResolvedValue(null as never)
          // Act
          const result = await gitAdapter.getStringContent('')

          // Assert
          expect(result).toBe('')
          expect(mockedReadBlob).toBeCalledWith(
            expect.objectContaining({
              dir: config.repo,
              oid: config.to,
              filepath: '',
            })
          )
        })
      })
      describe('when blob does not reference a LFS file', () => {
        it('return blob as a string', async () => {
          // Arrange
          const expected = 'test'
          const gitAdapter = GitAdapter.getInstance(config)
          mockedReadBlob.mockImplementation(() =>
            Promise.resolve({ blob: Buffer.from(expected) })
          )
          isLFSmocked.mockReturnValueOnce(false)
          // Act
          const result = await gitAdapter.getStringContent('')

          // Assert
          expect(result).toBe(expected)
          expect(mockedReadBlob).toBeCalledWith(
            expect.objectContaining({
              dir: config.repo,
              oid: config.to,
              filepath: '',
            })
          )
        })
      })
    })
    describe('when readBlob throws exception', () => {
      describe('when error name is NotFoundError', () => {
        it('returns empty content', async () => {
          // Arrange
          const gitAdapter = GitAdapter.getInstance(config)
          mockedReadBlob.mockImplementation(() => {
            const error = new Error()
            error.name = 'NotFoundError'
            return Promise.reject(error)
          })
          // Act
          const result = await gitAdapter.getStringContent('')

          // Assert
          expect(result).toBe('')
          expect(mockedReadBlob).toBeCalledWith(
            expect.objectContaining({
              dir: config.repo,
              oid: config.to,
              filepath: '',
            })
          )
        })
      })
      describe('when error name is not NotFoundError', () => {
        it('throws the exception', async () => {
          // Arrange
          expect.assertions(1)
          const gitAdapter = GitAdapter.getInstance(config)
          mockedReadBlob.mockImplementation(() =>
            Promise.reject(new Error('test'))
          )
          // Act
          try {
            await gitAdapter.getStringContent('')
          } catch {
            // Assert
            expect(mockedReadBlob).toBeCalledWith(
              expect.objectContaining({
                dir: config.repo,
                oid: config.to,
                filepath: '',
              })
            )
          }
        })
      })
    })
  })

  describe('getFilesPath', () => {
    it('calls walk', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      await gitAdapter.getFilesPath()

      // Assert
      expect(mockedWalk).toBeCalled()
    })
  })

  describe('getFilesFrom', () => {
    describe('when path is a directory', () => {
      it('returns the list of files under this directory', async () => {
        // Arrange
        const content = 'content'
        const path = 'relative/path'
        const gitAdapter = GitAdapter.getInstance(config)
        mockedReadObject.mockImplementation(() =>
          Promise.resolve({ type: 'tree' })
        )
        mockedWalk.mockImplementation(() =>
          Promise.resolve([
            {
              path,
              content: new TextEncoder().encode(content),
            },
          ])
        )

        // Act
        const result = await gitAdapter.getFilesFrom('directory/path')

        // Assert

        expect(result).toEqual(
          expect.arrayContaining([{ path, content: Buffer.from(content) }])
        )
      })
    })
    describe('when path is a file', () => {
      it('returns the file content', async () => {
        // Arrange
        const content = 'content'
        const path = 'file/path'
        const gitAdapter = GitAdapter.getInstance(config)
        mockedReadObject.mockImplementation(() =>
          Promise.resolve({
            type: 'blob',
            object: new TextEncoder().encode(content),
          })
        )

        // Act
        const result = await gitAdapter.getFilesFrom('file/path')

        // Assert

        expect(result).toEqual(
          expect.arrayContaining([{ path, content: Buffer.from(content) }])
        )
      })
    })
    describe('when path is not a directory nor a file', () => {
      it('throw an exception', async () => {
        // Arrange
        expect.assertions(1)
        const gitAdapter = GitAdapter.getInstance(config)
        mockedReadObject.mockImplementation(() => Promise.resolve({}))

        // Act
        try {
          await gitAdapter.getFilesFrom('wrong/path')
        } catch (error) {
          // Assert
          const err = error as Error
          expect(err.message).toBe(
            `Path wrong/path does not exist in ${config.to}`
          )
        }
      })
    })
  })

  describe('getDiffLines', () => {
    it('calls walk', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      await gitAdapter.getDiffLines()

      // Assert
      expect(mockedWalk).toBeCalled()
    })
  })

  describe('filePathWalker', () => {
    describe('when filepath should be ignored', () => {
      describe('when filepath is "."', () => {
        it('returns undefined', async () => {
          // Arrange

          // Act
          const result = await filePathWalker('')('.', [null])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when filepath is not subfolder of path', () => {
        it('returns undefined', async () => {
          // Arrange

          // Act
          const result = await filePathWalker('dir')('another-dir/file', [null])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when type is not blob', () => {
        it('returns undefined', async () => {
          // Arrange
          const entry = {
            type: jest.fn(() => Promise.resolve('not-blob')),
          } as unknown as WalkerEntry

          // Act
          const result = await filePathWalker('dir')('dir/file', [entry])

          // Assert
          expect(result).toBe(undefined)
        })
      })
    })
    describe('when path is afile', () => {
      it('returns the normalized file path ', async () => {
        // Arrange
        const entry = {
          type: jest.fn(() => Promise.resolve('blob')),
        } as unknown as WalkerEntry

        // Act
        const result = await filePathWalker('dir')('dir\\file', [entry])

        // Assert
        expect(result).toBe('dir/file')
      })
    })
  })

  describe('diffLineWalker', () => {
    describe('when filepath should be ignored', () => {
      describe('when filepath is "."', () => {
        it('returns undefined', async () => {
          // Arrange

          // Act
          const result = await diffLineWalker(false)('.', [null])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when first version of the file is not a blob', () => {
        it('returns undefined', async () => {
          // Arrange
          const entry = {
            type: jest.fn(() => Promise.resolve('not-blob')),
          } as unknown as WalkerEntry

          // Act
          const result = await diffLineWalker(false)('file/path', [entry])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when second version of the file is not a blob', () => {
        it('returns undefined', async () => {
          // Arrange
          const firstEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
          } as unknown as WalkerEntry
          const secondEntry = {
            type: jest.fn(() => Promise.resolve('not-blob')),
          } as unknown as WalkerEntry

          // Act
          const result = await diffLineWalker(false)('file/path', [
            firstEntry,
            secondEntry,
          ])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when both oid are equals', () => {
        it('returns undefined', async () => {
          // Arrange
          const firstEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => 10),
          } as unknown as WalkerEntry
          const secondEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => 10),
          } as unknown as WalkerEntry

          // Act
          const result = await diffLineWalker(false)('file/path', [
            firstEntry,
            secondEntry,
          ])

          // Assert
          expect(result).toBe(undefined)
        })
      })
    })

    describe('when filepath should be treated', () => {
      describe('when file is added', () => {
        it('returns the addition type and normalized path', async () => {
          // Arrange
          const firstEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => undefined),
          } as unknown as WalkerEntry
          const secondEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => 10),
          } as unknown as WalkerEntry

          // Act
          const result = await diffLineWalker(false)('file\\path', [
            firstEntry,
            secondEntry,
          ])

          // Assert
          expect(result).toBe('A\tfile/path')
        })
      })
      describe('when file is deleted', () => {
        it('returns the deletion type and normalized path', async () => {
          // Arrange
          const firstEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => 10),
          } as unknown as WalkerEntry
          const secondEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => undefined),
          } as unknown as WalkerEntry

          // Act
          const result = await diffLineWalker(false)('file\\path', [
            firstEntry,
            secondEntry,
          ])

          // Assert
          expect(result).toBe('D\tfile/path')
        })
      })
      describe('when file is modified', () => {
        it('returns the modification type and normalized path', async () => {
          // Arrange
          const firstEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => 10),
          } as unknown as WalkerEntry
          const secondEntry = {
            type: jest.fn(() => Promise.resolve('blob')),
            oid: jest.fn(() => 11),
          } as unknown as WalkerEntry

          // Act
          const result = await diffLineWalker(false)('file\\path', [
            firstEntry,
            secondEntry,
          ])

          // Assert
          expect(result).toBe('M\tfile/path')
        })

        describe('when whitespace should be ignored', () => {
          describe('when files contains only whitespace differences', () => {
            it('returns undefined', async () => {
              // Arrange
              const firstEntry = {
                type: jest.fn(() => Promise.resolve('blob')),
                oid: jest.fn(() => 10),
                content: jest.fn(() =>
                  Promise.resolve(Buffer.from('<code> \t\n</code>'))
                ),
              } as unknown as WalkerEntry
              const secondEntry = {
                type: jest.fn(() => Promise.resolve('blob')),
                oid: jest.fn(() => 11),
                content: jest.fn(() =>
                  Promise.resolve(Buffer.from(' \t\n<code> </code> \t\n'))
                ),
              } as unknown as WalkerEntry

              // Act
              const result = await diffLineWalker(true)('file\\path', [
                firstEntry,
                secondEntry,
              ])

              // Assert
              expect(result).toBe(undefined)
            })
          })
          describe('when files contains whitespace and non whitespace differences', () => {
            it('returns the modification type and normalized path', async () => {
              // Arrange
              const firstEntry = {
                type: jest.fn(() => Promise.resolve('blob')),
                oid: jest.fn(() => 10),
                content: jest.fn(() =>
                  Promise.resolve(Buffer.from('<code> \t\n</code>'))
                ),
              } as unknown as WalkerEntry
              const secondEntry = {
                type: jest.fn(() => Promise.resolve('blob')),
                oid: jest.fn(() => 11),
                content: jest.fn(() =>
                  Promise.resolve(
                    Buffer.from(' \t\n<code>information</code> \t\n')
                  )
                ),
              } as unknown as WalkerEntry

              // Act
              const result = await diffLineWalker(true)('file\\path', [
                firstEntry,
                secondEntry,
              ])

              // Assert
              expect(result).toBe('M\tfile/path')
            })
          })
        })
      })
    })
  })

  describe('contentWalker', () => {
    describe('when filepath should be ignored', () => {
      describe('when filepath is "."', () => {
        it('returns undefined', async () => {
          // Arrange

          // Act
          const result = await contentWalker('')('.', [null])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when filepath is not subfolder of path', () => {
        it('returns undefined', async () => {
          // Arrange

          // Act
          const result = await contentWalker('dir')('another-dir/file', [null])

          // Assert
          expect(result).toBe(undefined)
        })
      })

      describe('when type is not blob', () => {
        it('returns undefined', async () => {
          // Arrange
          const entry = {
            type: jest.fn(() => Promise.resolve('not-blob')),
          } as unknown as WalkerEntry

          // Act
          const result = await contentWalker('dir')('dir/file', [entry])

          // Assert
          expect(result).toBe(undefined)
        })
      })
    })
    describe('when path is afile', () => {
      it('returns the normalized file path ', async () => {
        // Arrange
        const content = new TextEncoder().encode('content')
        const entry = {
          type: jest.fn(() => Promise.resolve('blob')),
          content: jest.fn(() => Promise.resolve(content)),
        } as unknown as WalkerEntry

        // Act
        const result = await contentWalker('dir')('dir\\file', [entry])

        // Assert
        expect(result).toStrictEqual({
          path: 'dir/file',
          content,
        })
      })
    })
  })
})
