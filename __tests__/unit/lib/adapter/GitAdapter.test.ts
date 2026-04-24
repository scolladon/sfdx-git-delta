'use strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { PassThrough } from 'node:stream'
import { EOL } from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GitAdapter from '../../../../src/adapter/GitAdapter'
import { IGNORE_WHITESPACE_PARAMS } from '../../../../src/constant/gitConstants'
import type { Config } from '../../../../src/types/config'
import {
  getLFSObjectContentPath,
  isLFS,
} from '../../../../src/utils/gitLfsHelper'
import { getWork } from '../../../__utils__/testWork'

const {
  mockedRaw,
  mockedAddConfig,
  mockedRevParse,
  mockedGetContent,
  mockedGetContentOrEscalate,
  mockedClose,
} = vi.hoisted(() => ({
  mockedRaw: vi.fn(),
  mockedAddConfig: vi.fn(),
  mockedRevParse: vi.fn(),
  mockedGetContent: vi.fn(),
  mockedGetContentOrEscalate: vi.fn(),
  mockedClose: vi.fn(),
}))

vi.mock('simple-git', () => {
  return {
    simpleGit: vi.fn(function () {
      return {
        raw: mockedRaw,
        revparse: mockedRevParse,
        addConfig: mockedAddConfig,
      }
    }),
  }
})

vi.mock('../../../../src/adapter/gitBatchCatFile', () => ({
  GitBatchCatFile: vi.fn(function () {
    return {
      getContent: mockedGetContent,
      getContentOrEscalate: mockedGetContentOrEscalate,
      close: mockedClose,
    }
  }),
}))

vi.mock('../../../../src/utils/gitLfsHelper')
vi.mock('node:fs/promises')
vi.mock('../../../../src/utils/LoggingService')

const isLFSmocked = vi.mocked(isLFS)
const getLFSObjectContentPathMocked = vi.mocked(getLFSObjectContentPath)
const readFileMocked = vi.mocked(readFile)

// Records every spawn invocation preBuildTreeIndex makes via _spawnLines
// so assertions below can inspect the args (replaces the prior check on
// simpleGit.raw).
const spawnCalls: Array<{ cmd: string; args: string[] }> = []
const createLsTreeFake = (files: string[]) => {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const fake = Object.assign(new EventEmitter(), {
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout,
    stderr,
    killed: false,
    exitCode: null as number | null,
    kill: vi.fn(),
  })
  process.nextTick(() => {
    if (files.length > 0) {
      stdout.write(`${files.join(EOL)}${EOL}`)
    }
    stdout.end()
    fake.emit('close', 0)
  })
  return fake
}

// Helper to pre-build tree index for a revision. preBuildTreeIndex now
// consumes _spawnLines (spawned git ls-tree → readline), so the stub
// needs to emit lines on a Readable stdout and close cleanly.
const setupTreeIndex = async (
  sut: GitAdapter,
  files: string[],
  revision: string
) => {
  const spawnFn = vi.fn((cmd: string, args: string[]) => {
    spawnCalls.push({ cmd, args })
    return createLsTreeFake(files) as never
  })
  sut.setSpawnFn(spawnFn)
  await sut.preBuildTreeIndex(revision, [])
}

// Queues one spawn response per invocation so tests that build multiple
// tree indexes (different revisions, scoped paths) get distinct output.
const installSpawnQueue = (sut: GitAdapter, responses: string[][]) => {
  let idx = 0
  const spawnFn = vi.fn((cmd: string, args: string[]) => {
    spawnCalls.push({ cmd, args })
    const files = responses[idx++] ?? []
    return createLsTreeFake(files) as never
  })
  sut.setSpawnFn(spawnFn)
}

// Same shape but for diff output — each response is a single raw stdout
// string (newline-delimited lines), not a files array. getDiffLines and
// _getNumstatLines run per-call so the queue dispenses one per spawn.
const createRawStreamFake = (stdoutText: string) => {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const fake = Object.assign(new EventEmitter(), {
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout,
    stderr,
    killed: false,
    exitCode: null as number | null,
    kill: vi.fn(),
  })
  process.nextTick(() => {
    if (stdoutText.length > 0) stdout.write(stdoutText)
    stdout.end()
    fake.emit('close', 0)
  })
  return fake
}

const installDiffSpawnQueue = (sut: GitAdapter, responses: string[]) => {
  let idx = 0
  const spawnFn = vi.fn((cmd: string, args: string[]) => {
    spawnCalls.push({ cmd, args })
    const output = responses[idx++] ?? ''
    return createRawStreamFake(output) as never
  })
  sut.setSpawnFn(spawnFn)
}

describe('GitAdapter', () => {
  let config: Config
  beforeEach(() => {
    GitAdapter.closeAll()
    spawnCalls.length = 0
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
        await setupTreeIndex(
          gitAdapter,
          ['path/to/file.txt', 'other/file.cls'],
          config.to
        )

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
        await setupTreeIndex(
          gitAdapter,
          ['path/to/file.txt', 'other/file.cls'],
          config.to
        )

        // Act
        const result = await gitAdapter.pathExists('path/to')

        // Assert
        expect(result).toBe(true)
      })

      it('returns true for a top-level directory', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        await setupTreeIndex(gitAdapter, ['path/to/file.txt'], config.to)

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
        await setupTreeIndex(gitAdapter, ['path/to/file.txt'], config.to)

        // Act
        const result = await gitAdapter.pathExists('nonexistent')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('Given no pre-built index, When pathExists, Then returns false', () => {
      it('returns false', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)

        // Act
        const result = await gitAdapter.pathExists('path/to/file.txt')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('Given multiple calls for same revision, When pathExists, Then uses single raw call', () => {
      it('uses the tree index without additional git calls', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        await setupTreeIndex(
          gitAdapter,
          ['path/to/file.txt', 'other/file.cls'],
          config.to
        )

        // Act
        const result1 = await gitAdapter.pathExists('path/to/file.txt')
        const result2 = await gitAdapter.pathExists('other/file.cls')
        const result3 = await gitAdapter.pathExists('nonexistent')

        // Assert
        expect(result1).toBe(true)
        expect(result2).toBe(true)
        expect(result3).toBe(false)
        expect(spawnCalls).toHaveLength(1)
        expect(spawnCalls[0]).toEqual({
          cmd: 'git',
          args: ['ls-tree', '--name-only', '-r', config.to],
        })
      })
    })

    describe('Given custom revision, When pathExists, Then uses custom revision', () => {
      it('uses the custom revision in git command', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        const customRevision = 'feature-branch'
        await setupTreeIndex(gitAdapter, ['path/to/file.txt'], customRevision)

        // Act
        const result = await gitAdapter.pathExists(
          'path/to/file.txt',
          customRevision
        )

        // Assert
        expect(result).toBe(true)
        expect(
          spawnCalls.some(
            c =>
              c.cmd === 'git' &&
              JSON.stringify(c.args) ===
                JSON.stringify(['ls-tree', '--name-only', '-r', customRevision])
          )
        ).toBe(true)
      })
    })

    describe('Given different revisions, When pathExists, Then caches separately per revision', () => {
      it('builds one tree index per revision', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        installSpawnQueue(gitAdapter, [['path/file1.txt'], ['path/file2.txt']])
        await gitAdapter.preBuildTreeIndex('rev1', [])
        await gitAdapter.preBuildTreeIndex('rev2', [])

        // Act
        const result1 = await gitAdapter.pathExists('path/file1.txt', 'rev1')
        const result2 = await gitAdapter.pathExists('path/file2.txt', 'rev2')
        const cached1 = await gitAdapter.pathExists('path/file1.txt', 'rev1')

        // Assert
        expect(result1).toBe(true)
        expect(result2).toBe(true)
        expect(cached1).toBe(true)
        expect(spawnCalls).toHaveLength(2)
      })
    })

    describe('Given pathExists does not use batch cat-file, When pathExists, Then no getContent calls are made', () => {
      it('does not call getContent', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        await setupTreeIndex(gitAdapter, ['path/to/file.txt'], config.to)

        // Act
        await gitAdapter.pathExists('path/to/file.txt')

        // Assert
        expect(mockedGetContent).not.toHaveBeenCalled()
      })
    })

    describe('Given partial path match, When pathExists, Then does not false-positive', () => {
      it('does not match partial directory names', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        await setupTreeIndex(gitAdapter, ['path/together/file.txt'], config.to)

        // Act
        const result = await gitAdapter.pathExists('path/to')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('Given root path, When pathExists, Then returns true if tree has files', () => {
      it.each([
        '',
        '.',
        './',
      ])('returns true for root path "%s"', async rootPath => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        await setupTreeIndex(gitAdapter, ['src/file.ts'], config.to)

        // Act
        const result = await gitAdapter.pathExists(rootPath)

        // Assert
        expect(result).toBe(true)
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
    describe('when getContent returns content', () => {
      describe('when content references a LFS file', () => {
        it('returns content from LFS', async () => {
          // Arrange
          const gitAdapter = GitAdapter.getInstance(config)
          mockedGetContent.mockResolvedValue(
            Buffer.from('lfs content') as never
          )
          isLFSmocked.mockReturnValueOnce(true)
          getLFSObjectContentPathMocked.mockReturnValueOnce('lfs/path')
          readFileMocked.mockResolvedValue(Buffer.from('') as never)

          // Act
          const result = await gitAdapter.getStringContent({
            path: 'file.txt',
            oid: config.to,
          })

          // Assert
          expect(result).toBe('')
          expect(mockedGetContent).toHaveBeenCalledWith(config.to, 'file.txt')
        })
      })
      describe('when content does not reference a LFS file', () => {
        it('return the content', async () => {
          // Arrange
          const expected = 'test'
          const gitAdapter = GitAdapter.getInstance(config)
          mockedGetContent.mockResolvedValue(Buffer.from(expected) as never)
          isLFSmocked.mockReturnValueOnce(false)

          // Act
          const result = await gitAdapter.getStringContent({
            path: 'file.txt',
            oid: config.to,
          })

          // Assert
          expect(result).toBe(expected)
          expect(mockedGetContent).toHaveBeenCalledWith(config.to, 'file.txt')
        })
      })
    })
    describe('when called twice on the same instance', () => {
      it('reuses the same batch process', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedGetContent.mockResolvedValue(Buffer.from('content') as never)
        isLFSmocked.mockReturnValue(false)

        // Act
        await gitAdapter.getStringContent({
          path: 'file1.txt',
          oid: config.to,
        })
        await gitAdapter.getStringContent({
          path: 'file2.txt',
          oid: config.to,
        })

        // Assert
        expect(mockedGetContent).toHaveBeenCalledTimes(2)
      })
    })
    describe('when getContent throws exception', () => {
      it('throws the exception', async () => {
        // Arrange
        const gitAdapter = GitAdapter.getInstance(config)
        mockedGetContent.mockRejectedValue(new Error('test') as never)

        // Act & Assert
        await expect(
          gitAdapter.getStringContent({ path: 'file.txt', oid: config.to })
        ).rejects.toThrow('test')
        expect(mockedGetContent).toHaveBeenCalledWith(config.to, 'file.txt')
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
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual([
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ])
      expect(
        spawnCalls.some(
          c =>
            c.cmd === 'git' &&
            JSON.stringify(c.args) ===
              JSON.stringify(['ls-tree', '--name-only', '-r', config.to])
        )
      ).toBe(true)
    })

    it('Given sub-path, When getFilesPath, Then returns only files under that sub-path', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual(['path/to/file', 'path/to/another/file'])
    })

    it('Given exact file path, When getFilesPath, Then returns that file', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(
        gitAdapter,
        ['path/to/file.txt', 'other/file.cls'],
        config.to
      )

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
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result = await gitAdapter.getFilesPath('path')
      const cachedResult = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual(allFiles)
      expect(cachedResult).toStrictEqual(result)
      expect(spawnCalls).toHaveLength(1)
    })

    it('Given sub-path call after parent call, When getFilesPath, Then uses same tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = [
        'path/from/file',
        'path/to/file',
        'path/to/another/file',
      ]
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result = await gitAdapter.getFilesPath('path')
      const subCachedResult = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual(allFiles)
      expect(subCachedResult).toEqual(allFiles.slice(1))
      expect(spawnCalls).toHaveLength(1)
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
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result = await gitAdapter.getFilesPath(['path1', 'path2'])

      // Assert
      expect(result).toEqual(allFiles)
      expect(spawnCalls).toHaveLength(1)
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
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result1 = await gitAdapter.getFilesPath(['path1', 'path2'])
      const result2 = await gitAdapter.getFilesPath(['path1'])
      const result3 = await gitAdapter.getFilesPath(['path2'])

      // Assert
      expect(result1).toEqual(allFiles)
      expect(result2).toEqual(['path1/file1', 'path1/file2'])
      expect(result3).toEqual(['path2/file1', 'path2/file2'])
      expect(spawnCalls).toHaveLength(1)
    })

    it('Given no pre-built index, When getFilesPath, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      const result = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual([])
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
      await setupTreeIndex(gitAdapter, ['path/file.txt'], customRevision)

      // Act
      await gitAdapter.getFilesPath('path', customRevision)

      // Assert
      expect(
        spawnCalls.some(
          c =>
            c.cmd === 'git' &&
            JSON.stringify(c.args) ===
              JSON.stringify(['ls-tree', '--name-only', '-r', customRevision])
        )
      ).toBe(true)
    })

    it('Given different revisions, When getFilesPath, Then builds one tree index per revision', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      installSpawnQueue(gitAdapter, [['path/file1'], ['path/file2']])
      await gitAdapter.preBuildTreeIndex('rev1', [])
      await gitAdapter.preBuildTreeIndex('rev2', [])

      // Act
      const result1 = await gitAdapter.getFilesPath('path', 'rev1')
      const result2 = await gitAdapter.getFilesPath('path', 'rev2')
      const cached1 = await gitAdapter.getFilesPath('path', 'rev1')

      // Assert
      expect(result1).toEqual(['path/file1'])
      expect(result2).toEqual(['path/file2'])
      expect(cached1).toEqual(['path/file1'])
      expect(spawnCalls).toHaveLength(2)
    })

    it('Given sub-path call with custom revision, When getFilesPath, Then uses same tree index', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const customRevision = 'feature-branch'
      const allFiles = ['path/to/file', 'path/to/another/file']
      await setupTreeIndex(gitAdapter, allFiles, customRevision)

      // Act
      const result = await gitAdapter.getFilesPath('path', customRevision)
      const subCachedResult = await gitAdapter.getFilesPath(
        'path/to',
        customRevision
      )

      // Assert
      expect(result).toEqual(allFiles)
      expect(subCachedResult).toEqual(allFiles)
      expect(spawnCalls).toHaveLength(1)
    })

    it('Given path not in tree, When getFilesPath, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(gitAdapter, ['other/file.txt'], config.to)

      // Act
      const result = await gitAdapter.getFilesPath('path')

      // Assert
      expect(result).toEqual([])
    })

    it('Given partial directory name match, When getFilesPath, Then does not false-positive', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(gitAdapter, ['path/together/file.txt'], config.to)

      // Act
      const result = await gitAdapter.getFilesPath('path/to')

      // Assert
      expect(result).toEqual([])
    })

    it.each([
      '',
      '.',
      './',
    ])('Given root path "%s", When getFilesPath, Then returns all files', async rootPath => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const allFiles = ['src/a.ts', 'src/b.ts', 'lib/c.js']
      await setupTreeIndex(gitAdapter, allFiles, config.to)

      // Act
      const result = await gitAdapter.getFilesPath(rootPath)

      // Assert
      expect(result).toEqual(expect.arrayContaining(allFiles))
      expect(result).toHaveLength(allFiles.length)
    })
  })

  describe('getDiffLines', () => {
    it('Given diff output and no changesManifest flag, When getDiffLines, Then issues one name-status diff with --no-renames and filter=AMD (default sgd behaviour — rename detection is opt-in)', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      installDiffSpawnQueue(gitAdapter, ['A\ttest\nM\tfile\nD\tanotherfile\n'])

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual(['A\ttest', 'M\tfile', 'D\tanotherfile'])
      expect(spawnCalls).toHaveLength(1)
      expect(spawnCalls[0]!.args).toEqual(
        expect.arrayContaining([
          'diff',
          '--name-status',
          '--no-renames',
          '--diff-filter=AMD',
        ])
      )
    })

    it('Given changesManifest is set, When getDiffLines, Then the name-status call carries -M and filter=AMDR so renames surface as R-lines', async () => {
      // Arrange
      config.changesManifest = 'changes.json'
      const gitAdapter = GitAdapter.getInstance(config)
      installDiffSpawnQueue(gitAdapter, ['A\ttest\nR100\told.cls\tnew.cls\n'])

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual(['A\ttest', 'R100\told.cls\tnew.cls'])
      expect(spawnCalls[0]!.args).toEqual(
        expect.arrayContaining([
          'diff',
          '--name-status',
          '-M',
          '--diff-filter=AMDR',
        ])
      )
    })

    it('Given empty diff output, When getDiffLines, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      installDiffSpawnQueue(gitAdapter, [''])

      // Act
      const result = await gitAdapter.getDiffLines()

      // Assert
      expect(result).toEqual([])
    })

    it('Given multiple lines, When getDiffLines, Then preserves ordering', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      installDiffSpawnQueue(gitAdapter, [
        'A\tnewFile1\nA\tnewFile2\nM\tmodFile1\nD\tdelFile1\nD\tdelFile2\n',
      ])

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
      it('When getDiffLines without changesManifest, Then issues three numstat calls with --no-renames covering A/M/D only (no R-filter call)', async () => {
        // Arrange — default whitespace path: rename detection off. -M is
        // replaced by --no-renames and the dedicated R-filter call is
        // skipped altogether.
        config.ignoreWhitespace = true
        const gitAdapter = GitAdapter.getInstance(config)
        installDiffSpawnQueue(gitAdapter, [
          '8\t0\ttest\n', // ADDITION
          '3\t2\tfile\n', // MODIFICATION
          '', // DELETION empty
        ])

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual(['A\ttest', 'M\tfile'])
        expect(spawnCalls).toHaveLength(3)
        for (const call of spawnCalls) {
          expect(call.args).toEqual(
            expect.arrayContaining([
              '--numstat',
              '--no-renames',
              ...IGNORE_WHITESPACE_PARAMS,
            ])
          )
        }
      })

      it('When getDiffLines with changesManifest set, Then falls back to four numstat calls with whitespace params and -M, covering A/M/D plus an R filter parsed from -z output', async () => {
        // Arrange — name-status does not honour --ignore-all-space, so the
        // adapter must issue per-filter numstat calls instead. With -M on
        // A/M/D, renames drop out of those filters and come in via the 4th
        // R-filter call whose -z output encodes paths null-separated.
        config.ignoreWhitespace = true
        config.changesManifest = 'changes.json'
        const gitAdapter = GitAdapter.getInstance(config)
        // A/M/D stream through spawn; the -z rename call still uses
        // simpleGit.raw because readline is newline-oriented.
        installDiffSpawnQueue(gitAdapter, [
          '8\t0\ttest\n', // ADDITION
          '3\t2\tfile\n', // MODIFICATION
          '', // DELETION empty
        ])
        mockedRaw.mockResolvedValueOnce(
          '1\t1\t\0classes/OldName.cls\0classes/NewName.cls\0' as never
        )

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual([
          'A\ttest',
          'M\tfile',
          'R\tclasses/OldName.cls\tclasses/NewName.cls',
        ])
        expect(spawnCalls).toHaveLength(3)
        for (const call of spawnCalls) {
          expect(call.args).toEqual(
            expect.arrayContaining([
              '--numstat',
              '-M',
              ...IGNORE_WHITESPACE_PARAMS,
            ])
          )
        }
        expect(spawnCalls[0]!.args).toEqual(
          expect.arrayContaining(['--diff-filter=A'])
        )
        expect(spawnCalls[1]!.args).toEqual(
          expect.arrayContaining(['--diff-filter=M'])
        )
        expect(spawnCalls[2]!.args).toEqual(
          expect.arrayContaining(['--diff-filter=D'])
        )
        expect(mockedRaw).toHaveBeenCalledWith(
          expect.arrayContaining(['--numstat', '-M', '-z', '--diff-filter=R'])
        )
      })

      it('When a -z R-output token triplet has an empty src or dst, When getDiffLines, Then it is skipped safely', async () => {
        // Arrange — extra defensive-parse coverage for malformed -z records.
        config.ignoreWhitespace = true
        config.changesManifest = 'changes.json'
        const gitAdapter = GitAdapter.getInstance(config)
        installDiffSpawnQueue(gitAdapter, ['', '', ''])
        mockedRaw.mockResolvedValueOnce('1\t1\t\0\0\0' as never)

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual([])
      })

      it('When a whitespace-only modification is present, Then numstat reports 0/0 and it is dropped by the empty-line filter', async () => {
        // Arrange
        config.ignoreWhitespace = true
        config.changesManifest = 'changes.json'
        const gitAdapter = GitAdapter.getInstance(config)
        // numstat under --ignore-all-space emits nothing for files whose
        // only changes are whitespace (or 0\t0\t on some git versions —
        // both collapse to no line through filter(Boolean)).
        installDiffSpawnQueue(gitAdapter, ['', '', ''])
        mockedRaw.mockResolvedValueOnce('' as never)

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual([])
      })

      it('When -z output contains two renames in one call, Then the stride-3 parser yields both synthetic R-lines', async () => {
        // Arrange — verifies the stride across multiple records.
        config.ignoreWhitespace = true
        config.changesManifest = 'changes.json'
        const gitAdapter = GitAdapter.getInstance(config)
        installDiffSpawnQueue(gitAdapter, ['', '', ''])
        mockedRaw.mockResolvedValueOnce(
          ('1\t1\t\0a.cls\0b.cls\0' + '2\t2\t\0c.cls\0d.cls\0') as never
        )

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual(['R\ta.cls\tb.cls', 'R\tc.cls\td.cls'])
        expect(mockedRaw).toHaveBeenCalledWith(
          expect.arrayContaining(['diff', '--'])
        )
      })

      it('When -z output has src-populated but dst empty, Then the triplet is skipped (|| guard, not &&)', async () => {
        // Arrange — distinguishes `!src || !dst` (intended) from the
        // `!src && !dst` mutation: only one side empty must still skip.
        config.ignoreWhitespace = true
        config.changesManifest = 'changes.json'
        const gitAdapter = GitAdapter.getInstance(config)
        installDiffSpawnQueue(gitAdapter, ['', '', ''])
        mockedRaw.mockResolvedValueOnce('1\t1\t\0src.cls\0\0' as never)

        // Act
        const result = await gitAdapter.getDiffLines()

        // Assert
        expect(result).toEqual([])
      })
    })

    it('Given binary files in diff, When getDiffLines, Then returns the status-prefixed path', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      installDiffSpawnQueue(gitAdapter, ['A\tbinaryFile.png\n'])

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
      await setupTreeIndex(
        gitAdapter,
        [
          'myDir/file1.txt',
          'myDir/file2.cls',
          'myDir/subDir/nested.txt',
          'other/file.txt',
        ],
        'HEAD'
      )

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.cls', 'subDir'])
    })

    it('Given directory with nested files only, When listDirAtRevision, Then returns unique immediate children', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(
        gitAdapter,
        [
          'myDir/subDir/file1.txt',
          'myDir/subDir/file2.txt',
          'myDir/otherDir/file3.txt',
        ],
        'HEAD'
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
      await setupTreeIndex(
        gitAdapter,
        ['myDir/file1.txt', 'myDir/file2.cls'],
        revision
      )
      mockedRaw.mockClear()

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', revision)

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.cls'])
      expect(mockedRaw).not.toHaveBeenCalled()
    })

    it('Given directory does not exist in tree, When listDirAtRevision, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(gitAdapter, ['other/file.txt'], 'HEAD')

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('Given no pre-built index, When listDirAtRevision, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act
      const result = await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('Given empty dir, When listDirAtRevision, Then returns top-level entries', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(
        gitAdapter,
        ['classes/MyClass.cls', 'triggers/MyTrigger.trigger'],
        'HEAD'
      )

      // Act
      const result = await gitAdapter.listDirAtRevision('', 'HEAD')

      // Assert
      expect(result).toEqual(expect.arrayContaining(['classes', 'triggers']))
    })

    it('Given pre-built tree index, When listDirAtRevision called, Then no additional raw calls', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      await setupTreeIndex(gitAdapter, ['myDir/file1.txt'], 'HEAD')
      mockedRaw.mockClear()

      // Act
      await gitAdapter.listDirAtRevision('myDir', 'HEAD')

      // Assert
      expect(mockedRaw).not.toHaveBeenCalled()
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

    it('Given multiple paths, When gitGrep is called, Then passes all paths to git grep', async () => {
      // Arrange
      GitAdapter.closeAll()
      const config = getWork().config
      const sut = GitAdapter.getInstance(config)
      mockedRaw.mockResolvedValueOnce(
        `${config.to}:dir1/file1.txt\n${config.to}:dir2/file2.txt` as never
      )

      // Act
      const result = await sut.gitGrep('pattern', ['dir1/', 'dir2/'])

      // Assert
      expect(result).toEqual(['dir1/file1.txt', 'dir2/file2.txt'])
      expect(mockedRaw).toHaveBeenCalledWith([
        'grep',
        '-l',
        'pattern',
        config.to,
        '--',
        'dir1/',
        'dir2/',
      ])
    })

    it('Given no matches, When gitGrep throws, Then returns empty array', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedRaw.mockRejectedValueOnce(new Error('no matches') as never)

      // Act
      const result = await gitAdapter.gitGrep('nonexistent', 'force-app/fields')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('preBuildTreeIndex', () => {
    it('Given scope paths, When preBuildTreeIndex is called, Then ls-tree is scoped', async () => {
      // Arrange
      GitAdapter.closeAll()
      const config = getWork().config
      const sut = GitAdapter.getInstance(config)
      installSpawnQueue(sut, [['dir1/file1.cls', 'dir1/file2.cls']])

      // Act
      await sut.preBuildTreeIndex(config.to, ['dir1/'])

      // Assert
      expect(spawnCalls).toEqual([
        {
          cmd: 'git',
          args: ['ls-tree', '--name-only', '-r', config.to, '--', 'dir1/'],
        },
      ])
    })

    it('Given pre-built index, When pathExists is called, Then uses cached index', async () => {
      // Arrange
      GitAdapter.closeAll()
      const config = getWork().config
      const sut = GitAdapter.getInstance(config)
      await setupTreeIndex(sut, ['dir1/file1.cls'], config.to)
      spawnCalls.length = 0

      // Act
      const exists = await sut.pathExists('dir1/file1.cls')

      // Assert
      expect(exists).toBe(true)
      expect(spawnCalls).toHaveLength(0)
    })

    it('Given empty scope paths, When preBuildTreeIndex is called, Then ls-tree has no path args', async () => {
      // Arrange
      GitAdapter.closeAll()
      const config = getWork().config
      const sut = GitAdapter.getInstance(config)
      installSpawnQueue(sut, [[]])

      // Act
      await sut.preBuildTreeIndex(config.to, [])

      // Assert
      expect(spawnCalls).toEqual([
        { cmd: 'git', args: ['ls-tree', '--name-only', '-r', config.to] },
      ])
    })

    it('Given git command throws, When preBuildTreeIndex is called, Then does not throw', async () => {
      // Arrange
      GitAdapter.closeAll()
      const config = getWork().config
      const sut = GitAdapter.getInstance(config)
      const spawnFn = vi.fn(() => {
        throw new Error('spawn failed')
      })
      sut.setSpawnFn(spawnFn)

      // Act & Assert
      await expect(
        sut.preBuildTreeIndex(config.to, ['dir1/'])
      ).resolves.toBeUndefined()
    })

    it('Given already-cached revision, When preBuildTreeIndex is called, Then skips ls-tree', async () => {
      // Arrange
      GitAdapter.closeAll()
      const config = getWork().config
      const sut = GitAdapter.getInstance(config)
      await setupTreeIndex(sut, ['dir1/file1.cls'], config.to)
      spawnCalls.length = 0

      // Act
      await sut.preBuildTreeIndex(config.to, ['dir2/'])

      // Assert
      expect(spawnCalls).toHaveLength(0)
    })
  })

  describe('closeBatchProcess', () => {
    it('Given batch process was created, When closeBatchProcess, Then calls close', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      mockedGetContent.mockResolvedValue(Buffer.from('content') as never)
      isLFSmocked.mockReturnValueOnce(false)
      await gitAdapter.getStringContent({ path: 'file.txt', oid: config.to })

      // Act
      gitAdapter.closeBatchProcess()

      // Assert
      expect(mockedClose).toHaveBeenCalledTimes(1)
    })

    it('Given batch process was not created, When closeBatchProcess, Then does nothing', () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)

      // Act & Assert (should not throw)
      gitAdapter.closeBatchProcess()
      expect(mockedClose).not.toHaveBeenCalled()
    })
  })

  describe('closeAll', () => {
    it('Given instances with batch processes, When closeAll, Then closes all and clears instances', async () => {
      // Arrange
      GitAdapter.closeAll()
      mockedClose.mockClear()
      const gitAdapter = GitAdapter.getInstance(config)
      mockedGetContent.mockResolvedValue(Buffer.from('content') as never)
      isLFSmocked.mockReturnValueOnce(false)
      await gitAdapter.getStringContent({ path: 'file.txt', oid: config.to })

      // Act
      GitAdapter.closeAll()

      // Assert
      expect(mockedClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('streamContent', () => {
    const createFakeChild = () => {
      const stdin = { write: vi.fn(), end: vi.fn() }
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      const child = Object.assign(new EventEmitter(), {
        stdin,
        stdout,
        stderr,
        killed: false,
        exitCode: null as number | null,
        kill: vi.fn(function () {
          child.killed = true
          return true
        }),
      })
      return child
    }

    it('Given non-LFS content, When streamContent emits data, Then the returned stream forwards the bytes', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child as never))

      // Act
      const stream = gitAdapter.streamContent({
        path: 'classes/Big.cls',
        oid: 'abc',
      })
      const chunks: Buffer[] = []
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
      const done = new Promise<void>(resolve => stream.on('end', resolve))

      child.stdout.emit('data', Buffer.from('version 42'))
      child.stdout.emit('data', Buffer.from(' rest of blob'))
      child.stdout.emit('end')
      child.emit('close', 0)
      await done

      // Assert
      expect(Buffer.concat(chunks).toString()).toBe('version 42 rest of blob')
    })

    it('Given an LFS pointer in the first chunks, When streamContent runs, Then the child is killed and hand-off to LFS path is attempted', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child as never))
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/de/ad/deadbeef'
      )

      // Act
      const stream = gitAdapter.streamContent({
        path: 'resources/LargeAsset.bin',
        oid: 'deadbeef',
      })
      stream.on('error', () => undefined)

      child.stdout.emit(
        'data',
        Buffer.from('version https://git-lfs.github.com/spec/v1\n')
      )
      child.stdout.emit('data', Buffer.from('oid sha256:deadbeef\nsize 1\n'))
      child.stdout.emit('end')
      await new Promise(resolve => setImmediate(resolve))

      // Assert — the child was killed after detecting LFS, and the LFS path
      // resolver was consulted.
      expect(child.kill).toHaveBeenCalled()
      expect(getLFSObjectContentPathMocked).toHaveBeenCalled()
    })

    it('Given a malformed LFS pointer throws on resolution, When streamContent hands off, Then the consumer receives the error (not an uncaught exception)', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child as never))
      getLFSObjectContentPathMocked.mockImplementation(() => {
        throw new Error('Invalid LFS oid')
      })

      // Act
      const stream = gitAdapter.streamContent({
        path: 'resources/Bad.bin',
        oid: 'cafe',
      })
      const received = new Promise<Error | undefined>(resolve => {
        stream.on('error', err => resolve(err))
      })

      child.stdout.emit(
        'data',
        Buffer.from('version https://git-lfs.github.com/spec/v1\n')
      )
      child.stdout.emit('data', Buffer.from('oid sha256:bad\n'))
      child.stdout.emit('end')

      // Assert
      await expect(received).resolves.toMatchObject({
        message: 'Invalid LFS oid',
      })
    })

    it('Given an LFS pointer exceeds the cap, When streamContent buffers beyond the limit, Then the consumer receives a cap error', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child as never))

      // Act
      const stream = gitAdapter.streamContent({
        path: 'resources/Huge.bin',
        oid: 'aabbccdd',
      })
      const received = new Promise<Error | undefined>(resolve => {
        stream.on('error', err => resolve(err))
      })

      child.stdout.emit(
        'data',
        Buffer.from('version https://git-lfs.github.com/spec/v1\n')
      )
      // Push 2 KB beyond the 1 KB cap.
      child.stdout.emit('data', Buffer.alloc(2048, 0x61))

      // Assert
      await expect(received).resolves.toMatchObject({
        message: expect.stringContaining('LFS pointer exceeds expected size'),
      })
    })

    it('Given the streaming child closes, When another stream is created, Then the prior child is not retained in streamingChildren', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child1 = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child1 as never))
      const stream1 = gitAdapter.streamContent({ path: 'a', oid: 'o1' })
      stream1.on('error', () => undefined)
      stream1.on('data', () => undefined)

      // Act — child1 closes normally; splice runs on 'close' event.
      child1.stdout.emit('data', Buffer.from('ok'))
      child1.stdout.emit('end')
      child1.emit('close', 0)
      await new Promise(resolve => setImmediate(resolve))

      // Assert — a fresh closeBatchProcess should not attempt to kill the
      // already-closed child because it was spliced on 'close'.
      gitAdapter.closeBatchProcess()
      expect(child1.kill).not.toHaveBeenCalled()
    })

    it('Given the streaming subprocess exits non-zero, When consuming the stream, Then the consumer receives an error', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child as never))

      // Act
      const stream = gitAdapter.streamContent({ path: 'missing', oid: 'aa' })
      const result = new Promise<Error | undefined>(resolve => {
        stream.on('error', err => resolve(err))
        stream.on('end', () => resolve(undefined))
      })
      child.stdout.emit('end')
      child.emit('close', 128)

      // Assert
      const err = await result
      expect(err?.message).toContain('git cat-file blob exited 128')
    })

    it('Given the subprocess emits an error event, When consuming the stream, Then the consumer is destroyed with that error', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const child = createFakeChild()
      gitAdapter.setSpawnFn(vi.fn(() => child as never))
      const spawnFailure = new Error('spawn ENOENT')

      // Act
      const stream = gitAdapter.streamContent({ path: 'any', oid: 'ab' })
      const received = new Promise<Error | undefined>(resolve => {
        stream.on('error', err => resolve(err))
      })
      child.emit('error', spawnFailure)

      // Assert
      await expect(received).resolves.toBe(spawnFailure)
    })

    it('Given a path beginning with a dash, When streamContent runs, Then the resulting stream errors without spawning', () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const spawnFn = vi.fn()
      gitAdapter.setSpawnFn(spawnFn as never)

      // Act
      const stream = gitAdapter.streamContent({
        path: '--version',
        oid: 'ab',
      })
      const received = new Promise<Error | undefined>(resolve => {
        stream.on('error', err => resolve(err))
      })

      // Assert
      expect(spawnFn).not.toHaveBeenCalled()
      return expect(received).resolves.toMatchObject({
        message: expect.stringContaining('Refusing to spawn'),
      })
    })
  })

  describe('closeBatchProcess with streaming children', () => {
    it('Given a streaming child is still alive, When closeBatchProcess runs, Then kill is called', () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const fakeChild = Object.assign(new EventEmitter(), {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        killed: false,
        exitCode: null as number | null,
        kill: vi.fn(),
      })
      gitAdapter.setSpawnFn(vi.fn(() => fakeChild as never))
      gitAdapter.streamContent({ path: 'f', oid: 'o' })

      // Act
      gitAdapter.closeBatchProcess()

      // Assert
      expect(fakeChild.kill).toHaveBeenCalled()
    })
  })

  describe('streamArchive', () => {
    it('Given path or revision starts with dash, When streamArchive runs, Then it throws without spawning', async () => {
      // Arrange
      const gitAdapter = GitAdapter.getInstance(config)
      const spawnFn = vi.fn()
      gitAdapter.setSpawnFn(spawnFn as never)

      // Act & Assert
      const iter = gitAdapter.streamArchive('--ref', 'abc')
      await expect(iter.next()).rejects.toThrow(/Refusing to spawn/)
      expect(spawnFn).not.toHaveBeenCalled()
    })

    it('Given a tar stream with two files and one directory entry, When streamArchive iterates, Then file entries yield and directory entries are skipped', async () => {
      // Arrange — build a valid ustar tar with 2 files + 1 dir
      const gitAdapter = GitAdapter.getInstance(config)
      const { pack } = await import('tar-stream')
      const tarPack = pack()
      tarPack.entry({ name: 'bundle/ignored-dir', type: 'directory' })
      tarPack.entry({ name: 'bundle/one.xml', size: 5 }, 'hello')
      tarPack.entry({ name: 'bundle/two.xml', size: 5 }, 'world')
      tarPack.finalize()
      const child = Object.assign(new EventEmitter(), {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: tarPack,
        stderr: new PassThrough(),
        killed: false,
        exitCode: null as number | null,
        kill: vi.fn(),
      })
      gitAdapter.setSpawnFn(vi.fn(() => child as never))

      // Act
      const entries: string[] = []
      for await (const entry of gitAdapter.streamArchive(
        'bundle',
        'revision'
      )) {
        entries.push(entry.path)
        entry.stream.resume()
      }

      // Assert
      expect(entries).toEqual(['bundle/one.xml', 'bundle/two.xml'])
    })
  })
})
