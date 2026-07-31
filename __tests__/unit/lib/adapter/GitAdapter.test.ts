'use strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path/posix'

import type { Repository } from '@scolladon/tsgit'
import { openRepository, toSimilarityPercent } from '@scolladon/tsgit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GitAdapter from '../../../../src/adapter/GitAdapter'
import type { Config } from '../../../../src/types/config'
import {
  getLFSObjectContentPath,
  isLFS,
} from '../../../../src/utils/gitLfsHelper'

vi.mock('@scolladon/tsgit', () => ({
  openRepository: vi.fn(),
  toSimilarityPercent: vi.fn((score: number) => score),
}))
vi.mock('../../../../src/utils/gitLfsHelper')
vi.mock('node:fs/promises')
vi.mock('../../../../src/utils/LoggingService')

const mockOpenRepository = vi.mocked(openRepository)
const mockToSimilarityPercent = vi.mocked(toSimilarityPercent)
const isLFSMocked = vi.mocked(isLFS)
const getLFSObjectContentPathMocked = vi.mocked(getLFSObjectContentPath)
const readFileMocked = vi.mocked(readFile)

// Configurable fake Repository: every tsgit surface GitAdapter touches is a
// per-test vi.fn() so each test shapes only the branches it drives.
type FakeRepo = {
  revParse: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  diff: ReturnType<typeof vi.fn>
  primitives: {
    readObject: ReturnType<typeof vi.fn>
    readBlob: ReturnType<typeof vi.fn>
    flattenTree: ReturnType<typeof vi.fn>
    walkCommits: ReturnType<typeof vi.fn>
    streamBlob: ReturnType<typeof vi.fn>
  }
}

const makeFakeRepo = (): FakeRepo => ({
  revParse: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
  diff: vi.fn(),
  primitives: {
    readObject: vi.fn(),
    readBlob: vi.fn(),
    flattenTree: vi.fn(),
    walkCommits: vi.fn(),
    streamBlob: vi.fn(),
  },
})

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: 'HEAD',
  from: 'HEAD~1',
  output: '/out',
  source: ['force-app'],
  repo: '/repo',
  ignoreWhitespace: false,
  generateDelta: true,
  ...overrides,
})

const asCommit = (tree: string) => ({
  type: 'commit',
  data: { tree, parents: [] },
})

const flatten = (entries: Array<[string, { mode: string; id: string }]>) => ({
  entries: new Map(entries),
})

const drain = async (
  stream: AsyncIterable<Buffer | Uint8Array>
): Promise<Buffer> => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

const collect = async <T>(source: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = []
  for await (const item of source) out.push(item)
  return out
}

const streamDiff = (sut: GitAdapter): Promise<string[]> =>
  collect(sut.streamDiffLines())

let fakeRepo: FakeRepo

beforeEach(() => {
  fakeRepo = makeFakeRepo()
  mockOpenRepository.mockResolvedValue(fakeRepo as unknown as Repository)
  mockToSimilarityPercent.mockImplementation((score: number) => score)
  isLFSMocked.mockReturnValue(false)
})

afterEach(async () => {
  await GitAdapter.closeAll()
})

describe('GitAdapter', () => {
  describe('Given getInstance', () => {
    it('When called twice with the same repo and to, Then it returns the same instance', () => {
      // Arrange
      const config = makeConfig()

      // Act
      const first = GitAdapter.getInstance(config)
      const second = GitAdapter.getInstance(config)

      // Assert
      expect(first).toBe(second)
    })

    it('When called with a different to, Then it returns a different instance', () => {
      // Arrange
      const config = makeConfig()

      // Act
      const first = GitAdapter.getInstance(config)
      const second = GitAdapter.getInstance(makeConfig({ to: 'HEAD~1' }))

      // Assert
      expect(first).not.toBe(second)
    })
  })

  describe('Given getRepo caching', () => {
    it('When multiple methods run against the same instance, Then openRepository is called only once', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('deadbeef')

      // Act
      await sut.parseRev('HEAD')
      await sut.parseRev('HEAD~1')

      // Assert
      expect(mockOpenRepository).toHaveBeenCalledOnce()
    })
  })

  describe('Given close', () => {
    it('When the repo was never opened, Then close resolves without disposing anything', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      await sut.close()

      // Assert
      expect(fakeRepo.dispose).not.toHaveBeenCalled()
    })

    it('When the repo was opened, Then close disposes it and clears the handle', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('abc')
      await sut.parseRev('HEAD')

      // Act
      await sut.close()

      // Assert
      expect(fakeRepo.dispose).toHaveBeenCalledOnce()
    })
  })

  describe('Given closeAll', () => {
    it('When multiple instances are open, Then it closes each and clears the instance map', async () => {
      // Arrange
      const secondRepo = makeFakeRepo()
      mockOpenRepository.mockResolvedValueOnce(
        fakeRepo as unknown as Repository
      )
      mockOpenRepository.mockResolvedValueOnce(
        secondRepo as unknown as Repository
      )
      fakeRepo.revParse.mockResolvedValue('abc')
      secondRepo.revParse.mockResolvedValue('def')
      const first = GitAdapter.getInstance(makeConfig())
      const second = GitAdapter.getInstance(makeConfig({ to: 'HEAD~1' }))
      await first.parseRev('HEAD')
      await second.parseRev('HEAD~1')

      // Act
      await GitAdapter.closeAll()

      // Assert
      expect(fakeRepo.dispose).toHaveBeenCalledOnce()
      expect(secondRepo.dispose).toHaveBeenCalledOnce()
      expect(GitAdapter.getInstance(makeConfig())).not.toBe(first)
    })
  })

  describe('Given configureRepository', () => {
    it('When called, Then it resolves without opening the repository', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      await sut.configureRepository()

      // Assert
      expect(mockOpenRepository).not.toHaveBeenCalled()
    })
  })

  describe('Given parseRev', () => {
    it('When called with a ref, Then it resolves the object id via repo.revParse', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('deadbeef')

      // Act
      const result = await sut.parseRev('HEAD')

      // Assert
      expect(result).toBe('deadbeef')
      expect(fakeRepo.revParse).toHaveBeenCalledWith('HEAD')
    })
  })

  describe('Given getFirstCommitRef', () => {
    it('When a parentless commit is found while walking history, Then it returns that commit id', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('head-oid')
      fakeRepo.primitives.walkCommits.mockReturnValue(
        (async function* () {
          yield { id: 'mid-oid', data: { parents: ['head-oid'] } }
          yield { id: 'root-oid', data: { parents: [] } }
        })()
      )

      // Act
      const result = await sut.getFirstCommitRef()

      // Assert
      expect(result).toBe('root-oid')
      expect(fakeRepo.primitives.walkCommits).toHaveBeenCalledWith({
        from: ['head-oid'],
      })
    })

    it('When no parentless commit is found, Then it returns HEAD', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('head-oid')
      fakeRepo.primitives.walkCommits.mockReturnValue(
        (async function* () {
          yield { id: 'mid-oid', data: { parents: ['head-oid'] } }
        })()
      )

      // Act
      const result = await sut.getFirstCommitRef()

      // Assert
      expect(result).toBe('head-oid')
    })
  })

  describe('Given preBuildTreeIndex', () => {
    it('When called for a revision already indexed, Then it does not rebuild the index', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )

      // Act
      await sut.preBuildTreeIndex('HEAD', [])
      await sut.preBuildTreeIndex('HEAD', [])

      // Assert
      expect(fakeRepo.primitives.flattenTree).toHaveBeenCalledOnce()
    })

    it('When scopePaths are provided, Then only in-scope paths are indexed (ROOT_PATHS stripped)', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/foo.cls', { mode: '100644', id: 'blob-1' }],
          ['other/bar.cls', { mode: '100644', id: 'blob-2' }],
        ])
      )

      // Act
      await sut.preBuildTreeIndex('HEAD', ['.', 'force-app'])

      // Assert
      expect(await sut.getFilesPath('')).toEqual(['force-app/foo.cls'])
    })

    it('When indexing the revision fails, Then the failure is swallowed and the revision stays unindexed', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('boom'))

      // Act
      await sut.preBuildTreeIndex('BAD', [])

      // Assert
      expect(await sut.getFilesPath('', 'BAD')).toEqual([])
    })
  })

  describe('Given getBufferContent', () => {
    it('When the blob is not LFS, Then it returns the raw blob content', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-1',
        content: new Uint8Array(Buffer.from('hello')),
      })

      // Act
      const result = await sut.getBufferContent({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toEqual(Buffer.from('hello'))
      expect(fakeRepo.primitives.readBlob).toHaveBeenCalledWith('blob-1')
    })

    it('When the blob is an LFS pointer, Then it resolves the content from the LFS object file', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-1',
        content: new Uint8Array(Buffer.from('pointer')),
      })
      isLFSMocked.mockReturnValue(true)
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/aabb'
      )
      readFileMocked.mockResolvedValue(Buffer.from('resolved-content') as never)

      // Act
      const result = await sut.getBufferContent({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toEqual(Buffer.from('resolved-content'))
      expect(readFileMocked).toHaveBeenCalledWith(
        join('/repo', '.git/lfs/objects/aa/bb/aabb')
      )
    })

    it('When the same revision is requested twice, Then the tree is flattened only once (index cached)', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/foo.cls', { mode: '100644', id: 'blob-1' }],
          ['force-app/bar.cls', { mode: '100644', id: 'blob-2' }],
        ])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-1',
        content: new Uint8Array(Buffer.from('x')),
      })

      // Act
      await sut.getBufferContent({ path: 'force-app/foo.cls', oid: 'HEAD' })
      await sut.getBufferContent({ path: 'force-app/bar.cls', oid: 'HEAD' })

      // Assert
      expect(fakeRepo.primitives.flattenTree).toHaveBeenCalledOnce()
    })

    it('When the revision resolves to a non-commit object, Then it rejects with a descriptive error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('tree-oid')
      fakeRepo.primitives.readObject.mockResolvedValue({
        type: 'tree',
        data: {},
      })

      // Act & Assert
      await expect(
        sut.getBufferContent({ path: 'force-app/foo.cls', oid: 'HEAD' })
      ).rejects.toThrow("'HEAD' does not resolve to a commit")
    })

    it('When the path is not present in the indexed tree, Then it rejects with a not-found error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(flatten([]))

      // Act & Assert
      await expect(
        sut.getBufferContent({ path: 'missing.cls', oid: 'HEAD' })
      ).rejects.toThrow("Path 'missing.cls' not found at 'HEAD'")
    })

    it('When the flattened tree mixes blob and non-blob modes, Then only blob-bearing entries resolve (gitlinks and trees excluded)', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/foo.cls', { mode: '100644', id: 'blob-1' }],
          ['force-app/script.sh', { mode: '100755', id: 'blob-2' }],
          ['force-app/link', { mode: '120000', id: 'blob-3' }],
          ['force-app/dir', { mode: '40000', id: 'tree-2' }],
          ['submodule', { mode: '160000', id: 'gitlink-1' }],
        ])
      )
      await sut.preBuildTreeIndex('HEAD', [])

      // Act
      const files = await sut.getFilesPath('')

      // Assert
      expect(files.sort()).toEqual(
        ['force-app/foo.cls', 'force-app/link', 'force-app/script.sh'].sort()
      )
    })

    it('When a flattened tree path uses backslash separators, Then it is normalized to forward slashes', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app\\foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      await sut.preBuildTreeIndex('HEAD', [])

      // Act
      const files = await sut.getFilesPath('')

      // Assert
      expect(files).toEqual(['force-app/foo.cls'])
    })
  })

  describe('Given getBufferContentOrEscalate', () => {
    it('When called, Then it delegates to getBufferContent and returns the same content', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-1',
        content: new Uint8Array(Buffer.from('escalate-me')),
      })

      // Act
      const result = await sut.getBufferContentOrEscalate({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toEqual(Buffer.from('escalate-me'))
    })
  })

  describe('Given getStringContent', () => {
    it('When called, Then it returns the buffer content decoded as UTF-8', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-1',
        content: new Uint8Array(Buffer.from('hello world')),
      })

      // Act
      const result = await sut.getStringContent({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toBe('hello world')
    })
  })

  describe('Given streamContent', () => {
    it('When the content resolves, Then the stream ends with the full buffer', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-1',
        content: new Uint8Array(Buffer.from('streamed')),
      })

      // Act
      const result = await drain(
        sut.streamContent({ path: 'force-app/foo.cls', oid: 'HEAD' })
      )

      // Assert
      expect(result).toEqual(Buffer.from('streamed'))
    })

    it('When the underlying read rejects with an Error, Then the stream is destroyed with that error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('read failed'))

      // Act & Assert
      await expect(
        drain(sut.streamContent({ path: 'force-app/foo.cls', oid: 'HEAD' }))
      ).rejects.toThrow('read failed')
    })

    it('When the underlying read rejects with a non-Error value, Then the stream is destroyed with a wrapped error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue('raw-string-failure')

      // Act & Assert
      await expect(
        drain(sut.streamContent({ path: 'force-app/foo.cls', oid: 'HEAD' }))
      ).rejects.toThrow('raw-string-failure')
    })
  })

  describe('Given streamArchive', () => {
    it('When entries are within scope, Then it streams each blob via streamBlob', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/foo.cls', { mode: '100644', id: 'blob-1' }],
          ['other/bar.cls', { mode: '100644', id: 'blob-2' }],
        ])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([
        Buffer.from('archived'),
      ])

      // Act
      const entries = await collect(sut.streamArchive('force-app', 'HEAD'))

      // Assert
      expect(entries).toHaveLength(1)
      expect(entries[0]?.path).toBe('force-app/foo.cls')
      expect(await drain(entries[0]!.stream)).toEqual(Buffer.from('archived'))
    })
  })

  describe('Given gitGrep', () => {
    const setUpTree = () => {
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/a.cls', { mode: '100644', id: 'blob-a' }],
          ['force-app/b.cls', { mode: '100644', id: 'blob-b' }],
          ['other/c.cls', { mode: '100644', id: 'blob-c' }],
        ])
      )
    }

    it('When a file matches the pattern, Then its path is returned', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      setUpTree()
      fakeRepo.primitives.readBlob.mockImplementation((id: string) =>
        Promise.resolve({
          type: 'blob',
          id,
          content: new Uint8Array(
            Buffer.from(id === 'blob-a' ? 'needle' : 'nothing')
          ),
        })
      )

      // Act
      const result = await sut.gitGrep('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual(['force-app/a.cls'])
    })

    it('When no file matches the pattern, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      setUpTree()
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-a',
        content: new Uint8Array(Buffer.from('nothing here')),
      })

      // Act
      const result = await sut.gitGrep('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('When the pathspec is a literal, Then out-of-scope files are never read', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      setUpTree()
      fakeRepo.primitives.readBlob.mockImplementation((id: string) =>
        Promise.resolve({
          type: 'blob',
          id,
          content: new Uint8Array(
            Buffer.from(id === 'blob-c' ? 'needle' : 'nothing')
          ),
        })
      )

      // Act
      const result = await sut.gitGrep('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
      expect(fakeRepo.primitives.readBlob).not.toHaveBeenCalledWith('blob-c')
    })

    it('When the underlying read fails, Then the error is swallowed and an empty array is returned', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('grep boom'))

      // Act
      const result = await sut.gitGrep('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given gitGrep pathspec matching (buildPathspecMatcher)', () => {
    const paths = [
      'force-app/foo.cls',
      'force-app/sub/bar.cls',
      'other/baz.cls',
    ]

    beforeEach(() => {
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten(
          paths.map(path => [path, { mode: '100644', id: `blob-${path}` }])
        )
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'any',
        content: new Uint8Array(Buffer.from('match-me')),
      })
    })

    it.each([
      ['./force-app', ['force-app/foo.cls', 'force-app/sub/bar.cls']],
      ['/force-app', ['force-app/foo.cls', 'force-app/sub/bar.cls']],
      ['other', ['other/baz.cls']],
      ['force-app/*.cls', ['force-app/foo.cls', 'force-app/sub/bar.cls']],
      ['force-app/f?o.cls', ['force-app/foo.cls']],
      ['*/baz.cls', ['other/baz.cls']],
    ])(
      'When the pathspec is %s, Then the matched files are %s',
      async (pathspec, expected) => {
        // Arrange
        const sut = GitAdapter.getInstance(makeConfig())

        // Act
        const result = await sut.gitGrep('match-me', pathspec)

        // Assert
        expect(result.sort()).toEqual([...expected].sort())
      }
    )

    it('When multiple pathspecs mix literal and glob forms, Then both kinds match', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      const result = await sut.gitGrep('match-me', ['other', 'force-app/*.cls'])

      // Assert
      expect(result.sort()).toEqual(
        ['force-app/foo.cls', 'force-app/sub/bar.cls', 'other/baz.cls'].sort()
      )
    })
  })

  describe('Given getFilesPath', () => {
    const setUpIndex = async (sut: GitAdapter) => {
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/classes/Foo.cls', { mode: '100644', id: 'blob-1' }],
          ['force-app/classes/Bar.cls', { mode: '100644', id: 'blob-2' }],
          ['force-app/objects/Baz.object', { mode: '100644', id: 'blob-3' }],
        ])
      )
      await sut.preBuildTreeIndex('HEAD', [])
    }

    it('When the revision was never indexed, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      const result = await sut.getFilesPath('force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('When called with the root path, Then it returns every indexed path', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      await setUpIndex(sut)

      // Act
      const result = await sut.getFilesPath('')

      // Assert
      expect(result.sort()).toEqual(
        [
          'force-app/classes/Foo.cls',
          'force-app/classes/Bar.cls',
          'force-app/objects/Baz.object',
        ].sort()
      )
    })

    it('When called with an exact file path, Then it returns only that file', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      await setUpIndex(sut)

      // Act
      const result = await sut.getFilesPath('force-app/classes/Foo.cls')

      // Assert
      expect(result).toEqual(['force-app/classes/Foo.cls'])
    })

    it('When called with a directory path, Then it returns the files under it', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      await setUpIndex(sut)

      // Act
      const result = await sut.getFilesPath('force-app/classes')

      // Assert
      expect(result.sort()).toEqual(
        ['force-app/classes/Foo.cls', 'force-app/classes/Bar.cls'].sort()
      )
    })

    it('When called with an array of paths, Then it aggregates the results', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      await setUpIndex(sut)

      // Act
      const result = await sut.getFilesPath([
        'force-app/classes/Foo.cls',
        'force-app/objects/Baz.object',
      ])

      // Assert
      expect(result.sort()).toEqual(
        ['force-app/classes/Foo.cls', 'force-app/objects/Baz.object'].sort()
      )
    })

    it('When called with a path absent from the indexed tree, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      await setUpIndex(sut)

      // Act
      const result = await sut.getFilesPath('force-app/missing-dir')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given pathExists', () => {
    it('When the revision was never indexed, Then it returns false', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      const result = await sut.pathExists('force-app', 'HEAD')

      // Assert
      expect(result).toBe(false)
    })

    it('When called with the root path against a non-empty index, Then it returns true', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      await sut.preBuildTreeIndex('HEAD', [])

      // Act — no explicit revision: exercises the config.to default parameter
      const result = await sut.pathExists('')

      // Assert
      expect(result).toBe(true)
    })

    it('When called with a specific path, Then it delegates to the tree index hasPath check', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      await sut.preBuildTreeIndex('HEAD', [])

      // Act & Assert
      expect(await sut.pathExists('force-app', 'HEAD')).toBe(true)
      expect(await sut.pathExists('force-app/missing.cls', 'HEAD')).toBe(false)
    })
  })

  describe('Given listDirAtRevision', () => {
    it('When the revision was never indexed, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      const result = await sut.listDirAtRevision('force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('When the revision is indexed, Then it lists the direct children of the directory', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/classes/Foo.cls', { mode: '100644', id: 'blob-1' }],
          ['force-app/objects/Baz.object', { mode: '100644', id: 'blob-2' }],
        ])
      )
      await sut.preBuildTreeIndex('HEAD', [])

      // Act
      const result = await sut.listDirAtRevision('force-app', 'HEAD')

      // Assert
      expect(result.sort()).toEqual(['classes', 'objects'].sort())
    })

    it('When the directory is absent from an indexed revision, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['force-app/classes/Foo.cls', { mode: '100644', id: 'blob-1' }],
        ])
      )
      await sut.preBuildTreeIndex('HEAD', [])

      // Act
      const result = await sut.listDirAtRevision('does-not-exist', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given streamDiffLines repo.diff invocation', () => {
    it('When changesManifest is not configured, Then rename detection is requested as false', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ changesManifest: undefined })
      )
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut)

      // Assert
      expect(fakeRepo.diff).toHaveBeenCalledWith(
        expect.objectContaining({ detectRenames: false })
      )
    })

    it('When changesManifest is configured, Then rename detection is requested as true', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ changesManifest: 'manifest.json' })
      )
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut)

      // Assert
      expect(fakeRepo.diff).toHaveBeenCalledWith(
        expect.objectContaining({ detectRenames: true })
      )
    })

    it('When ignoreWhitespace is enabled, Then the whitespace options are passed to repo.diff', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ ignoreWhitespace: true }))
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut)

      // Assert
      expect(fakeRepo.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreWhitespace: 'all',
          ignoreBlankLines: true,
        })
      )
    })

    it('When ignoreWhitespace is disabled, Then no whitespace options are passed to repo.diff', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ ignoreWhitespace: false })
      )
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut)

      // Assert
      const callArgs = fakeRepo.diff.mock.calls[0]?.[0]
      expect(callArgs).not.toHaveProperty('ignoreWhitespace')
      expect(callArgs).not.toHaveProperty('ignoreBlankLines')
    })

    it('When source scopes include ROOT_PATHS entries, Then they are stripped before filtering changes', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: ['.', 'force-app'] })
      )
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'other/Unrelated.cls',
            newId: 'oid',
            newMode: '100644',
          },
        ],
      })

      // Act
      const result = await streamDiff(sut)

      // Assert — 'other/Unrelated.cls' is out of the 'force-app' scope; if
      // '.' were not stripped it would keep everything regardless of scope.
      expect(result).toEqual([])
    })
  })

  describe('Given streamDiffLines change classification (toDiffLines)', () => {
    const change = {
      add: (overrides: Partial<{ newPath: string; newMode: string }> = {}) => ({
        type: 'add',
        newPath: 'force-app/New.cls',
        newId: 'new-oid',
        newMode: '100644',
        ...overrides,
      }),
      delete: (
        overrides: Partial<{ oldPath: string; oldMode: string }> = {}
      ) => ({
        type: 'delete',
        oldPath: 'force-app/Old.cls',
        oldId: 'old-oid',
        oldMode: '100644',
        ...overrides,
      }),
      modify: (
        overrides: Partial<{
          path: string
          oldMode: string
          newMode: string
        }> = {}
      ) => ({
        type: 'modify',
        path: 'force-app/Mod.cls',
        oldId: 'old-oid',
        newId: 'new-oid',
        oldMode: '100644',
        newMode: '100644',
        ...overrides,
      }),
      rename: (
        overrides: Partial<{
          oldPath: string
          newPath: string
          oldMode: string
          newMode: string
        }> = {}
      ) => ({
        type: 'rename',
        oldPath: 'force-app/Old.cls',
        newPath: 'force-app/New.cls',
        oldId: 'old-oid',
        newId: 'new-oid',
        oldMode: '100644',
        newMode: '100644',
        similarity: { score: 87 },
        ...overrides,
      }),
      typeChange: () => ({
        type: 'type-change',
        path: 'force-app/Type.cls',
        oldId: 'old-oid',
        newId: 'new-oid',
        oldMode: '100644',
        newMode: '120000',
      }),
      copy: () => ({
        type: 'copy',
        oldPath: 'force-app/Src.cls',
        newPath: 'force-app/Dst.cls',
        oldId: 'old-oid',
        newId: 'new-oid',
        oldMode: '100644',
        newMode: '100644',
        similarity: { score: 100 },
      }),
    }

    it.each([
      ['add in scope', change.add(), ['force-app'], ['A\tforce-app/New.cls']],
      [
        'add via gitlink is skipped',
        change.add({ newMode: '160000' }),
        ['force-app'],
        [],
      ],
      ['add out of scope is skipped', change.add(), ['other'], []],
      [
        'add with empty scope is kept',
        change.add(),
        ['.'],
        ['A\tforce-app/New.cls'],
      ],
      [
        'add with a scope equal to the file path is kept',
        change.add({ newPath: 'force-app' }),
        ['force-app'],
        ['A\tforce-app'],
      ],
      [
        'delete in scope',
        change.delete(),
        ['force-app'],
        ['D\tforce-app/Old.cls'],
      ],
      [
        'delete via gitlink is skipped',
        change.delete({ oldMode: '160000' }),
        ['force-app'],
        [],
      ],
      ['delete out of scope is skipped', change.delete(), ['other'], []],
      [
        'modify in scope',
        change.modify(),
        ['force-app'],
        ['M\tforce-app/Mod.cls'],
      ],
      [
        'modify with gitlink old mode is skipped',
        change.modify({ oldMode: '160000' }),
        ['force-app'],
        [],
      ],
      ['modify out of scope is skipped', change.modify(), ['other'], []],
      [
        'rename with both sides in scope',
        change.rename(),
        ['force-app'],
        ['R087\tforce-app/Old.cls\tforce-app/New.cls'],
      ],
      [
        'rename with only the new side in scope',
        change.rename({ oldPath: 'other/Old.cls' }),
        ['force-app'],
        ['A\tforce-app/New.cls'],
      ],
      [
        'rename with only the old side in scope',
        change.rename({ newPath: 'other/New.cls' }),
        ['force-app'],
        ['D\tforce-app/Old.cls'],
      ],
      [
        'rename with neither side in scope',
        change.rename({ oldPath: 'other/Old.cls', newPath: 'other/New.cls' }),
        ['force-app'],
        [],
      ],
      ['type-change yields nothing', change.typeChange(), ['force-app'], []],
      ['copy yields nothing', change.copy(), ['force-app'], []],
    ])(
      'When the diff reports %s, Then the emitted lines match',
      async (_description, diffChange, source, expected) => {
        // Arrange
        const sut = GitAdapter.getInstance(makeConfig({ source }))
        fakeRepo.diff.mockResolvedValue({ changes: [diffChange] })

        // Act
        const result = await streamDiff(sut)

        // Assert
        expect(result).toEqual(expected)
      }
    )
  })
})
