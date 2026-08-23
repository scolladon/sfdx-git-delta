'use strict'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { join } from 'node:path/posix'
import { PassThrough, Readable } from 'node:stream'

import type { Repository } from '@scolladon/tsgit'
import { openRepository, toSimilarityPercent } from '@scolladon/tsgit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GitAdapter, {
  type DiffScopeVerdict,
  type DiffSpec,
} from '../../../../src/adapter/GitAdapter'
import {
  EscalateToStreamingSignal,
  SIZE_THRESHOLD,
} from '../../../../src/adapter/gitBlobReader'
import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import type { Config } from '../../../../src/types/config'
import { sanitizePath } from '../../../../src/utils/fsUtils'
import {
  getLFSObjectContentPath,
  isLFS,
} from '../../../../src/utils/gitLfsHelper'
import { Logger } from '../../../../src/utils/LoggingService'
import { sourceDirs } from '../../../__utils__/sourceDirs'

vi.mock('@scolladon/tsgit', () => ({
  openRepository: vi.fn(),
  toSimilarityPercent: vi.fn((score: number) => score),
}))
vi.mock('../../../../src/utils/gitLfsHelper')
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return { ...actual, createReadStream: vi.fn() }
})
vi.mock('node:fs/promises')
vi.mock('../../../../src/utils/LoggingService')

const mockOpenRepository = vi.mocked(openRepository)
const mockToSimilarityPercent = vi.mocked(toSimilarityPercent)
const isLFSMocked = vi.mocked(isLFS)
const getLFSObjectContentPathMocked = vi.mocked(getLFSObjectContentPath)
const readFileMocked = vi.mocked(readFile)
const statMocked = vi.mocked(stat)
const createReadStreamMocked = vi.mocked(createReadStream)

// Mirrors the module-private LFS constants in GitAdapter.ts (not exported —
// tests assert the streaming peek against the same literal values).
const LFS_MAGIC = Buffer.from('version https://git-lfs.github.com/spec/v1\n')
const LFS_POINTER_CAP = 1024

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
    mergeBase: ReturnType<typeof vi.fn>
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
    mergeBase: vi.fn(),
  },
})

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: 'HEAD',
  from: 'HEAD~1',
  mergeBase: false,
  output: '/out',
  source: sourceDirs('force-app'),
  repo: '/repo',
  ignoreWhitespace: false,
  generateDelta: true,
  ...overrides,
})

// The SUT absolutizes the pool key with platform resolve() then the posix
// sanitizePath, so an expectation written as a literal would be wrong on
// win32, where resolve('/repo') is 'C:\repo'. Compose it the same way.
const repoKey = (repo: string): string => sanitizePath(resolve(repo))!

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

// GitAdapter passes Logger.debug a `lazy` closure (see LoggingService.ts),
// not a plain string — the mocked Logger.debug already invokes it once for
// coverage (see src/utils/__mocks__/LoggingService.ts) but discards the
// result. Calling the captured closure ourselves resolves the same content
// so tests can assert on the actual log message rather than just the fact
// that Logger.debug was called.
const resolveLazyCall = (logFn: { mock: { calls: unknown[][] } }): string => {
  const [message] = logFn.mock.calls[0] as [() => string]
  return message()
}

// The verdict is owned by the caller (mirroring RepoGitDiff in production),
// not by the cached GitAdapter singleton — see the concurrency test at the
// end of the 'Given getUnmatchedSourceScopes' block for why that matters.
const freshVerdict = (): DiffScopeVerdict => ({
  changesSeen: 0,
  linesYielded: 0,
})

// The DiffSpec is owned by the caller (RepoGitDiff in production); tests
// that don't care about its exact shape reuse this default and override
// only the field under test.
const DEFAULT_DIFF_SPEC: DiffSpec = {
  from: 'HEAD~1',
  to: 'HEAD',
  detectRenames: false,
  ignoreWhitespace: false,
}

const streamDiff = (
  sut: GitAdapter,
  scopes: readonly string[] = sourceDirs('force-app'),
  spec: DiffSpec = DEFAULT_DIFF_SPEC
): Promise<string[]> =>
  collect(sut.streamDiffLines({ spec, verdict: freshVerdict(), scopes }))

let fakeRepo: FakeRepo

beforeEach(() => {
  fakeRepo = makeFakeRepo()
  mockOpenRepository.mockResolvedValue(fakeRepo as unknown as Repository)
  mockToSimilarityPercent.mockImplementation((score: number) => score)
  isLFSMocked.mockReturnValue(false)
  statMocked.mockResolvedValue({ size: 0 } as never)
})

afterEach(async () => {
  await GitAdapter.closeAll()
})

describe('GitAdapter', () => {
  describe('Given getInstance', () => {
    it('When called twice with the same repo, Then it returns the same instance', () => {
      // Arrange
      const config = makeConfig()

      // Act
      const first = GitAdapter.getInstance(config)
      const second = GitAdapter.getInstance(config)

      // Assert
      expect(first).toBe(second)
    })

    it('When called again after `to` was rewritten on the same config object, Then it still returns the same instance (regression: GitAdapter is bound to the repo, not the run)', () => {
      // Arrange
      const config = makeConfig()
      const first = GitAdapter.getInstance(config)

      // Act — mutating `to` used to move the pool key, minting a second
      // instance for the same repository.
      config.to = 'HEAD~1'
      const second = GitAdapter.getInstance(config)

      // Assert
      expect(first).toBe(second)
    })

    it('When called with a different repo, Then it returns a different instance', () => {
      // Arrange
      const first = GitAdapter.getInstance(makeConfig({ repo: '/repo-a' }))

      // Act
      const second = GitAdapter.getInstance(makeConfig({ repo: '/repo-b' }))

      // Assert
      expect(first).not.toBe(second)
    })

    it('When two configs reference the same repo through an unnormalised and a normalised path, Then it returns the same instance', () => {
      // Arrange
      const first = GitAdapter.getInstance(makeConfig({ repo: './repo' }))

      // Act
      const second = GitAdapter.getInstance(makeConfig({ repo: 'repo' }))

      // Assert
      expect(first).toBe(second)
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
      expect(mockOpenRepository).toHaveBeenCalledWith({
        cwd: repoKey('/repo'),
        trust: 'always',
        hooks: false,
        command: false,
      })
    })

    it('When a repository is opened, Then hook and merge-driver execution are switched off', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('abc')

      // Act
      await sut.parseRev('HEAD')

      // Assert
      expect(mockOpenRepository.mock.calls[0][0]).toMatchObject({
        hooks: false,
        command: false,
      })
    })
  })

  describe('Given a relative repository path', () => {
    // tsgit 3.5.0's own absolute-path predicate: a leading '/', a UNC '\\',
    // or a drive letter followed by a separator. Asserting against the
    // engine's own rule — not merely "not './'" — is what stops this
    // regressing.
    const TSGIT_ABSOLUTE_PATH = /^(\/|\\\\|[A-Za-z]:[/\\])/

    it('When the repository path is relative, Then openRepository receives an absolute cwd', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: './' }))
      fakeRepo.revParse.mockResolvedValue('abc')

      // Act
      await sut.parseRev('HEAD')

      // Assert
      const [{ cwd }] = mockOpenRepository.mock.calls[0] as [{ cwd: string }]
      expect(cwd).toMatch(TSGIT_ABSOLUTE_PATH)
      expect(cwd).toBe(repoKey('./'))
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

    it('When the cached handle is a failed open, Then close resolves, logs the reason and drops the handle', async () => {
      // Arrange
      const openFailure = new Error(
        'INVALID_OPTION: invalid option: cwd — must be an absolute path'
      )
      mockOpenRepository.mockRejectedValue(openFailure)
      const sut = GitAdapter.getInstance(makeConfig())
      await sut.parseRev('HEAD').catch(() => undefined)

      // Act
      const result = await sut.close().catch((thrown: unknown) => thrown)

      // Assert
      expect(result).toBeUndefined()
      expect(resolveLazyCall(Logger.debug)).toContain(repoKey('/repo'))
    })

    it('When close has run over a failed open, Then the next operation opens the repository again', async () => {
      // Arrange
      const openFailure = new Error(
        'INVALID_OPTION: invalid option: cwd — must be an absolute path'
      )
      mockOpenRepository.mockRejectedValue(openFailure)
      const sut = GitAdapter.getInstance(makeConfig())
      await sut.parseRev('HEAD').catch(() => undefined)
      await sut.close().catch(() => undefined)
      mockOpenRepository.mockResolvedValue(fakeRepo as unknown as Repository)
      fakeRepo.revParse.mockResolvedValue('abc')

      // Act
      const result = await sut.parseRev('HEAD')

      // Assert
      expect(mockOpenRepository).toHaveBeenCalledTimes(2)
      expect(result).toBe('abc')
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
      const second = GitAdapter.getInstance(makeConfig({ repo: '/repo-2' }))
      await first.parseRev('HEAD')
      await second.parseRev('HEAD~1')

      // Act
      await GitAdapter.closeAll()

      // Assert
      expect(fakeRepo.dispose).toHaveBeenCalledOnce()
      expect(secondRepo.dispose).toHaveBeenCalledOnce()
      expect(GitAdapter.getInstance(makeConfig())).not.toBe(first)
    })

    it('When one pooled instance holds a failed open, Then closeAll resolves and still clears the pool', async () => {
      // Arrange
      const openFailure = new Error(
        'INVALID_OPTION: invalid option: cwd — must be an absolute path'
      )
      mockOpenRepository.mockResolvedValueOnce(
        fakeRepo as unknown as Repository
      )
      mockOpenRepository.mockRejectedValueOnce(openFailure)
      fakeRepo.revParse.mockResolvedValue('abc')
      const first = GitAdapter.getInstance(makeConfig())
      const second = GitAdapter.getInstance(makeConfig({ repo: '/repo-2' }))
      await first.parseRev('HEAD')
      await second.parseRev('HEAD~1').catch(() => undefined)

      // Act
      const result = await GitAdapter.closeAll().catch(
        (thrown: unknown) => thrown
      )

      // Assert
      expect(result).toBeUndefined()
      expect(fakeRepo.dispose).toHaveBeenCalledOnce()
      expect(GitAdapter.getInstance(makeConfig())).not.toBe(first)
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

    it('When repo.revParse rejects with a raw tsgit error, Then it rejects with the mapped error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(
        Object.assign(new Error('object not found: bad-ref'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await sut
        .parseRev('bad-ref')
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe('bad-ref: not a valid git revision')
      expect((error as Error).message).not.toContain('OBJECT_NOT_FOUND')
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

    it('When repo.revParse rejects with a raw tsgit error, Then it rejects with the mapped error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(
        Object.assign(new Error('object not found: HEAD'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await sut
        .getFirstCommitRef()
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe('HEAD: not a valid git revision')
      expect((error as Error).message).not.toContain('OBJECT_NOT_FOUND')
    })
  })

  describe('Given getMergeBase', () => {
    // Distinct from the shared asCommit() helper: getMergeBase reads
    // fromCommit.id / toCommit.id off the peeled object, so the fake must
    // carry an `id` matching the oid it was read from (real tsgit
    // readObject results always do).
    const asCommitAt = (oid: string) => ({
      type: 'commit',
      id: oid,
      data: { tree: `tree-of-${oid}`, parents: [] },
    })

    beforeEach(() => {
      // getMergeBase now resolves both revisions via repo.revParse before
      // peeling (indexRevision's cast-free idiom) — identity pass-through
      // keeps every existing test's oid-shaped literals meaningful.
      fakeRepo.revParse.mockImplementation((ref: string) =>
        Promise.resolve(ref)
      )
    })

    it('When both refs resolve to commits, Then it calls primitives.mergeBase with both commit ids and returns the first result', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) =>
        Promise.resolve(asCommitAt(oid))
      )
      fakeRepo.primitives.mergeBase.mockResolvedValue(['base-oid'])

      // Act
      const result = await sut.getMergeBase('from-oid', 'to-oid')

      // Assert
      expect(result).toBe('base-oid')
      expect(fakeRepo.primitives.mergeBase).toHaveBeenCalledWith([
        'from-oid',
        'to-oid',
      ])
    })

    it('When primitives.mergeBase resolves several candidate bases (criss-cross history), Then it returns only the first, matching git merge-base without --all', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) =>
        Promise.resolve(asCommitAt(oid))
      )
      fakeRepo.primitives.mergeBase.mockResolvedValue([
        'first-base-oid',
        'second-base-oid',
      ])

      // Act
      const result = await sut.getMergeBase('from-oid', 'to-oid')

      // Assert
      expect(result).toBe('first-base-oid')
    })

    it('When primitives.mergeBase resolves an empty array, Then it resolves to undefined without throwing', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) =>
        Promise.resolve(asCommitAt(oid))
      )
      fakeRepo.primitives.mergeBase.mockResolvedValue([])

      // Act
      const result = await sut.getMergeBase('from-oid', 'to-oid')

      // Assert
      expect(result).toBeUndefined()
    })

    it('When primitives.mergeBase rejects with a raw tsgit error, Then it rejects with the mapped error using the "from...to" context', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) =>
        Promise.resolve(asCommitAt(oid))
      )
      fakeRepo.primitives.mergeBase.mockRejectedValue(
        Object.assign(new Error('object not found'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await sut
        .getMergeBase('from-oid', 'to-oid')
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        'from-oid...to-oid: not a valid git revision'
      )
    })

    it('When "from" is an annotated tag oid, Then it peels to the tagged commit before calling primitives.mergeBase', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) => {
        if (oid === 'tag-oid') {
          return Promise.resolve({
            type: 'tag',
            data: { object: 'commit-oid' },
          })
        }
        return Promise.resolve(asCommitAt(oid))
      })
      fakeRepo.primitives.mergeBase.mockResolvedValue(['base-oid'])

      // Act
      await sut.getMergeBase('tag-oid', 'to-oid')

      // Assert
      expect(fakeRepo.primitives.mergeBase).toHaveBeenCalledWith([
        'commit-oid',
        'to-oid',
      ])
    })

    it('When a ref is a two-deep tag chain, Then it peels through both tags to the terminal commit', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) => {
        if (oid === 'tag-oid') {
          return Promise.resolve({
            type: 'tag',
            data: { object: 'nested-tag-oid' },
          })
        }
        if (oid === 'nested-tag-oid') {
          return Promise.resolve({
            type: 'tag',
            data: { object: 'commit-oid' },
          })
        }
        return Promise.resolve(asCommitAt(oid))
      })
      fakeRepo.primitives.mergeBase.mockResolvedValue(['base-oid'])

      // Act
      await sut.getMergeBase('tag-oid', 'to-oid')

      // Assert
      expect(fakeRepo.primitives.mergeBase).toHaveBeenCalledWith([
        'commit-oid',
        'to-oid',
      ])
    })

    it('When both oids already resolve to commits, Then the peel loop does not iterate and the oids pass through unchanged', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) =>
        Promise.resolve(asCommitAt(oid))
      )
      fakeRepo.primitives.mergeBase.mockResolvedValue(['base-oid'])

      // Act
      await sut.getMergeBase('commit-a', 'commit-b')

      // Assert
      expect(fakeRepo.primitives.readObject).toHaveBeenCalledTimes(2)
      expect(fakeRepo.primitives.mergeBase).toHaveBeenCalledWith([
        'commit-a',
        'commit-b',
      ])
    })

    it('When an oid peels to a non-commit object, Then it rejects mentioning the label, wrapped by mapTsgitError', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) => {
        if (oid === 'tree-oid') {
          return Promise.resolve({ type: 'tree', data: {} })
        }
        return Promise.resolve(asCommitAt(oid))
      })

      // Act
      const error = await sut
        .getMergeBase('tree-oid', 'to-oid')
        .catch((thrown: unknown) => thrown)

      // Assert — the full mapped message, not a substring: a mapTsgitError
      // bypass (peelToCommit's raw Error escaping unwrapped) would still
      // contain the label and pass a substring-only assertion.
      expect((error as Error).message).toBe(
        "git operation failed: 'tree-oid' does not resolve to a commit"
      )
    })

    it('When "to" is an annotated tag oid, Then it peels to the tagged commit before calling primitives.mergeBase', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.primitives.readObject.mockImplementation((oid: string) => {
        if (oid === 'tag-oid') {
          return Promise.resolve({
            type: 'tag',
            data: { object: 'commit-oid' },
          })
        }
        return Promise.resolve(asCommitAt(oid))
      })
      fakeRepo.primitives.mergeBase.mockResolvedValue(['base-oid'])

      // Act
      await sut.getMergeBase('from-oid', 'tag-oid')

      // Assert
      expect(fakeRepo.primitives.mergeBase).toHaveBeenCalledWith([
        'from-oid',
        'commit-oid',
      ])
    })

    it('When revParse resolves each ref to a different oid, Then it calls primitives.mergeBase with the resolved oids, not the raw refs', async () => {
      // Arrange — overrides the describe-level identity pass-through:
      // proves getMergeBase actually plumbs revParse's result through
      // peelToCommit rather than treating the raw ref strings as
      // already-resolved oids. Reverting to the old `as ObjectId` casts
      // would call peelToCommit/mergeBase with 'from'/'to' verbatim and
      // this assertion would fail.
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockImplementation((ref: string) =>
        Promise.resolve(`${ref}-oid`)
      )
      fakeRepo.primitives.readObject.mockImplementation((oid: string) =>
        Promise.resolve(asCommitAt(oid))
      )
      fakeRepo.primitives.mergeBase.mockResolvedValue(['base-oid'])

      // Act
      await sut.getMergeBase('from', 'to')

      // Assert
      expect(fakeRepo.revParse).toHaveBeenCalledWith('from')
      expect(fakeRepo.revParse).toHaveBeenCalledWith('to')
      expect(fakeRepo.primitives.mergeBase).toHaveBeenCalledWith([
        'from-oid',
        'to-oid',
      ])
    })

    it('When repo.revParse rejects with a raw tsgit error, Then it rejects with the mapped error using the "from...to" context', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(
        Object.assign(new Error('object not found: bad-ref'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await sut
        .getMergeBase('bad-ref', 'to-oid')
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        'bad-ref...to-oid: not a valid git revision'
      )
    })
  })

  describe('Given buildTreeIndex', () => {
    it('When called twice for the same revision, Then it returns a distinct TreeIndex each time (no caching — the caller owns that)', async () => {
      // Arrange — GitAdapter no longer caches a tree index: buildTreeIndex
      // returns a fresh TreeIndex to its caller on every call (the
      // per-revision blob walk underneath is still memoized via
      // indexRevision/blobIdIndex — see 'Given getBufferContent' — but the
      // TreeIndex built from it is not memoized; that is the caller's job).
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )

      // Act
      const first = await sut.buildTreeIndex('HEAD', [])
      const second = await sut.buildTreeIndex('HEAD', [])

      // Assert
      expect(first).not.toBe(second)
      expect(second!.getFilesPath('')).toEqual(['force-app/foo.cls'])
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

      // Act — '.' is a ROOT_PATHS marker and must be dropped from the
      // scope filter rather than matching everything.
      const index = await sut.buildTreeIndex('HEAD', ['.', 'force-app'])

      // Assert
      expect(index!.getFilesPath('')).toEqual(['force-app/foo.cls'])
    })

    it('When scopePaths are only ROOT_PATHS markers, Then the index is unfiltered (whole-repo)', async () => {
      // Arrange — './', '.' and '' must all canonicalise to "no scope
      // filter" rather than matching nothing.
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
      const index = await sut.buildTreeIndex('HEAD', ['./'])

      // Assert
      expect(index!.getFilesPath('').sort()).toEqual(
        ['force-app/foo.cls', 'other/bar.cls'].sort()
      )
    })

    it('When indexing the revision fails, Then buildTreeIndex resolves to undefined', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('boom'))

      // Act
      const index = await sut.buildTreeIndex('BAD', [])

      // Assert
      expect(index).toBeUndefined()
    })

    it('When indexing the revision fails, Then it logs the tree-walk failure with the revision and the underlying error message', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('boom'))

      // Act
      await sut.buildTreeIndex('BAD', [])

      // Assert
      expect(resolveLazyCall(Logger.debug)).toBe(
        "buildTreeIndex: tree walk for 'BAD' failed: boom"
      )
    })

    it('When two calls use different scopes for the same revision, Then each returns an independent index scoped to its own call', async () => {
      // Arrange — regression coverage for concurrent runs against the
      // repo-wide GitAdapter pool: same revision, different --source-dir
      // scopes. There is no shared bucket to leak between them any more —
      // each call gets a plain, caller-owned TreeIndex object.
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
      const narrow = await sut.buildTreeIndex('HEAD', ['force-app'])
      const broad = await sut.buildTreeIndex('HEAD', [])

      // Assert
      expect(narrow!.getFilesPath('')).toEqual(['force-app/foo.cls'])
      expect(broad!.getFilesPath('').sort()).toEqual(
        ['force-app/foo.cls', 'other/bar.cls'].sort()
      )
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
        join(repoKey('/repo'), '.git/lfs/objects/aa/bb/aabb')
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

    it('When the revision is an annotated tag, Then the tag chain is peeled down to the tagged commit', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('tag-oid')
      fakeRepo.primitives.readObject
        .mockResolvedValueOnce({
          type: 'tag',
          data: { object: 'nested-tag-oid' },
        })
        .mockResolvedValueOnce({
          type: 'tag',
          data: { object: 'commit-oid' },
        })
        .mockResolvedValueOnce(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      // Act
      const index = await sut.buildTreeIndex('v1.0.0', [])

      // Assert
      expect(index!.getFilesPath('')).toEqual(['force-app/foo.cls'])
      expect(fakeRepo.primitives.readObject).toHaveBeenCalledWith('commit-oid')
      expect(fakeRepo.primitives.flattenTree).toHaveBeenCalledWith('tree-oid')
    })

    it('When an annotated tag peels to a non-commit object, Then it rejects with a descriptive error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('tag-oid')
      fakeRepo.primitives.readObject
        .mockResolvedValueOnce({
          type: 'tag',
          data: { object: 'blob-oid' },
        })
        .mockResolvedValueOnce({
          type: 'blob',
          data: {},
        })

      // Act & Assert
      await expect(
        sut.getBufferContent({ path: 'force-app/foo.cls', oid: 'v1.0.0' })
      ).rejects.toThrow("'v1.0.0' does not resolve to a commit")
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

      // Act
      const index = await sut.buildTreeIndex('HEAD', [])
      const files = index!.getFilesPath('')

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

      // Act
      const index = await sut.buildTreeIndex('HEAD', [])
      const files = index!.getFilesPath('')

      // Assert
      expect(files).toEqual(['force-app/foo.cls'])
    })

    it('When resolving the revision rejects with a raw tsgit error, Then getBufferContent rejects with the mapped error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(
        Object.assign(new Error('object not found: bad-oid'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await sut
        .getBufferContent({ path: 'force-app/foo.cls', oid: 'bad-oid' })
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe('bad-oid: not a valid git revision')
      expect((error as Error).message).not.toContain('OBJECT_NOT_FOUND')
    })
  })

  describe('Given getBufferContentOrEscalate', () => {
    it('When the accumulated blob stays under SIZE_THRESHOLD, Then it resolves with the concatenated content', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([
        Buffer.from('escal'),
        Buffer.from('ate-me'),
      ])

      // Act
      const result = await sut.getBufferContentOrEscalate({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toEqual(Buffer.from('escalate-me'))
      expect(fakeRepo.primitives.streamBlob).toHaveBeenCalledWith('blob-1')
    })

    it('When the accumulated content is an LFS pointer under the threshold, Then it resolves the content from the LFS object file', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([Buffer.from('pointer')])
      isLFSMocked.mockReturnValue(true)
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/aabb'
      )
      statMocked.mockResolvedValue({ size: 42 } as never)
      readFileMocked.mockResolvedValue(Buffer.from('resolved-content') as never)

      // Act
      const result = await sut.getBufferContentOrEscalate({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toEqual(Buffer.from('resolved-content'))
      expect(readFileMocked).toHaveBeenCalledWith(
        join(repoKey('/repo'), '.git/lfs/objects/aa/bb/aabb')
      )
    })

    it('When the resolved LFS object is exactly SIZE_THRESHOLD, Then it resolves without escalating', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([Buffer.from('pointer')])
      isLFSMocked.mockReturnValue(true)
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/aabb'
      )
      statMocked.mockResolvedValue({ size: SIZE_THRESHOLD } as never)
      readFileMocked.mockResolvedValue(Buffer.from('boundary-content') as never)

      // Act
      const result = await sut.getBufferContentOrEscalate({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })

      // Assert
      expect(result).toEqual(Buffer.from('boundary-content'))
    })

    it('When the resolved LFS object exceeds SIZE_THRESHOLD, Then it rejects with an EscalateToStreamingSignal sized from the object file', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([Buffer.from('pointer')])
      isLFSMocked.mockReturnValue(true)
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/aabb'
      )
      statMocked.mockResolvedValue({ size: SIZE_THRESHOLD + 1 } as never)
      const forRef = { path: 'force-app/foo.cls', oid: 'HEAD' }

      // Act
      const error = await sut
        .getBufferContentOrEscalate(forRef)
        .catch((thrown: unknown) => thrown)

      // Assert
      expect(error).toBeInstanceOf(EscalateToStreamingSignal)
      expect((error as EscalateToStreamingSignal).size).toBe(SIZE_THRESHOLD + 1)
      expect(readFileMocked).not.toHaveBeenCalled()
    })

    it('When the accumulated blob exceeds SIZE_THRESHOLD, Then it rejects with an EscalateToStreamingSignal carrying the size and ref', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/big.bin', { mode: '100644', id: 'blob-big' }]])
      )
      const oversizedChunk = Buffer.alloc(SIZE_THRESHOLD + 1, 0x61)
      fakeRepo.primitives.streamBlob.mockResolvedValue([oversizedChunk])
      const forRef = { path: 'force-app/big.bin', oid: 'HEAD' }

      // Act
      const error = await sut
        .getBufferContentOrEscalate(forRef)
        .catch((thrown: unknown) => thrown)

      // Assert
      expect(error).toBeInstanceOf(EscalateToStreamingSignal)
      expect((error as EscalateToStreamingSignal).size).toBe(SIZE_THRESHOLD + 1)
      expect((error as EscalateToStreamingSignal).ref).toEqual(forRef)
      expect((error as EscalateToStreamingSignal).name).toBe(
        'EscalateToStreamingSignal'
      )
    })

    it('When the accumulated blob length is exactly SIZE_THRESHOLD, Then it resolves without escalating', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/exact.bin', { mode: '100644', id: 'blob-exact' }]])
      )
      const exactChunk = Buffer.alloc(SIZE_THRESHOLD, 0x61)
      fakeRepo.primitives.streamBlob.mockResolvedValue([exactChunk])

      // Act
      const result = await sut.getBufferContentOrEscalate({
        path: 'force-app/exact.bin',
        oid: 'HEAD',
      })

      // Assert — Buffer.compare keeps the byte-for-byte strictness without
      // vitest's per-byte deep-equality diff, which dominates the test's
      // runtime on a 1 MiB buffer and times out under CI CPU contention.
      expect(result.length).toBe(SIZE_THRESHOLD)
      expect(Buffer.compare(result, exactChunk)).toBe(0)
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

    it('When resolving the revision rejects with a raw tsgit error, Then getStringContent rejects with the mapped error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(
        Object.assign(new Error('object not found: bad-oid'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await sut
        .getStringContent({ path: 'force-app/foo.cls', oid: 'bad-oid' })
        .catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).not.toContain('OBJECT_NOT_FOUND')
    })
  })

  describe('Given streamContent', () => {
    it('When the blob is shorter than the LFS magic length, Then the stream ends with the full buffer', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([
        Buffer.from('streamed'),
      ])

      // Act
      const result = await drain(
        sut.streamContent({ path: 'force-app/foo.cls', oid: 'HEAD' })
      )

      // Assert
      expect(result).toEqual(Buffer.from('streamed'))
    })

    it('When the blob is empty, Then the stream ends without writing any chunk', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/empty.cls', { mode: '100644', id: 'blob-empty' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([])

      // Act
      const result = await drain(
        sut.streamContent({ path: 'force-app/empty.cls', oid: 'HEAD' })
      )

      // Assert
      expect(result).toEqual(Buffer.alloc(0))
    })

    it('When the blob is not an LFS pointer, Then the stream forwards every chunk unchanged, respecting backpressure', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      const firstChunk = Buffer.alloc(100_000, 0x61)
      const secondChunk = Buffer.from('tail')
      fakeRepo.primitives.streamBlob.mockResolvedValue([
        firstChunk,
        secondChunk,
      ])

      // Act
      const result = await drain(
        sut.streamContent({ path: 'force-app/foo.cls', oid: 'HEAD' })
      )

      // Assert
      expect(result).toEqual(Buffer.concat([firstChunk, secondChunk]))
    })

    it('When a chunk write reports backpressure, Then the next chunk is withheld from the stream until it drains', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      const firstChunk = Buffer.alloc(100_000, 0x61)
      const secondChunk = Buffer.from('tail')
      fakeRepo.primitives.streamBlob.mockResolvedValue([
        firstChunk,
        secondChunk,
      ])

      // Act — the first (oversized) write reports backpressure; give the
      // pipeline a tick to reach it before anything drains the stream.
      const stream = sut.streamContent({
        path: 'force-app/foo.cls',
        oid: 'HEAD',
      })
      await new Promise(resolve => setImmediate(resolve))

      // Assert — the second chunk's write() call must stay withheld until
      // the stream drains, not fire on top of the still-buffered first one
      // (writableLength — not readableLength — reflects a pending write()
      // that has not yet been transformed through to the readable side).
      expect((stream as PassThrough).writableLength).toBe(firstChunk.length)

      // Act — draining the stream lets the withheld chunk through
      const result = await drain(stream)

      // Assert
      expect(result).toEqual(Buffer.concat([firstChunk, secondChunk]))
    })

    it('When the blob starts with the LFS pointer magic, Then it pipes content from the resolved LFS object file', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/asset.bin', { mode: '100644', id: 'blob-lfs' }]])
      )
      const pointer = Buffer.concat([
        LFS_MAGIC,
        Buffer.from('oid sha256:abc\nsize 3\n'),
      ])
      fakeRepo.primitives.streamBlob.mockResolvedValue([pointer])
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/abc'
      )
      const lfsStream = new PassThrough()
      createReadStreamMocked.mockReturnValue(lfsStream as never)

      // Act
      const resultPromise = drain(
        sut.streamContent({ path: 'force-app/asset.bin', oid: 'HEAD' })
      )
      await new Promise(resolve => setImmediate(resolve))
      lfsStream.end(Buffer.from('lfs-content'))
      const result = await resultPromise

      // Assert
      expect(result).toEqual(Buffer.from('lfs-content'))
      expect(getLFSObjectContentPathMocked).toHaveBeenCalledWith(pointer)
      expect(createReadStreamMocked).toHaveBeenCalledWith(
        join(repoKey('/repo'), '.git/lfs/objects/aa/bb/abc')
      )
    })

    it('When the LFS pointer exceeds LFS_POINTER_CAP, Then the stream is destroyed with a pointer-too-large error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/asset.bin', { mode: '100644', id: 'blob-lfs' }]])
      )
      const oversized = Buffer.alloc(LFS_POINTER_CAP + 1, 0x61)
      fakeRepo.primitives.streamBlob.mockResolvedValue([LFS_MAGIC, oversized])

      // Act & Assert
      await expect(
        drain(sut.streamContent({ path: 'force-app/asset.bin', oid: 'HEAD' }))
      ).rejects.toThrow('LFS pointer exceeds expected size')
    })

    it('When the peeked head alone already exceeds LFS_POINTER_CAP, Then the stream is destroyed with a pointer-too-large error before pulling further chunks', async () => {
      // Arrange — a single oversized chunk containing the magic prefix
      // means peekHead's own head already breaches the cap, so the guard
      // must fire before accumulatePointer's for-await loop ever runs (the
      // sibling test above only exercises the cap check inside that loop).
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/asset.bin', { mode: '100644', id: 'blob-lfs' }]])
      )
      const oversizedHead = Buffer.concat([
        LFS_MAGIC,
        Buffer.alloc(LFS_POINTER_CAP, 0x61),
      ])
      fakeRepo.primitives.streamBlob.mockResolvedValue([oversizedHead])
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/abc'
      )
      const lfsStream = new PassThrough()
      createReadStreamMocked.mockReturnValue(lfsStream as never)

      // Act — the rejection expectation is attached in the same tick as the
      // drain (no gap where the promise could reject unobserved); ending
      // the (only conditionally reached) mocked LFS file stream afterwards
      // just guards against a hang if the cap guard fails to fire.
      const assertion = expect(
        drain(sut.streamContent({ path: 'force-app/asset.bin', oid: 'HEAD' }))
      ).rejects.toThrow('LFS pointer exceeds expected size')
      await new Promise(resolve => setImmediate(resolve))
      lfsStream.end(Buffer.from('unused'))

      // Assert
      await assertion
    })

    it('When the LFS pointer body is exactly LFS_POINTER_CAP bytes, Then it resolves without throwing', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/asset.bin', { mode: '100644', id: 'blob-lfs' }]])
      )
      const filler = Buffer.alloc(LFS_POINTER_CAP - LFS_MAGIC.length, 0x61)
      fakeRepo.primitives.streamBlob.mockResolvedValue([LFS_MAGIC, filler])
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/abc'
      )
      const lfsStream = new PassThrough()
      createReadStreamMocked.mockReturnValue(lfsStream as never)

      // Act
      const resultPromise = drain(
        sut.streamContent({ path: 'force-app/asset.bin', oid: 'HEAD' })
      )
      await new Promise(resolve => setImmediate(resolve))
      lfsStream.end(Buffer.from('lfs-content'))
      const result = await resultPromise

      // Assert
      expect(result).toEqual(Buffer.from('lfs-content'))
    })

    it('When the LFS pointer spans multiple chunks, Then every chunk pulled after the peeked head is included in the accumulated pointer', async () => {
      // Arrange — the magic prefix arrives as its own chunk so peekHead's
      // head is exactly LFS_MAGIC, leaving the body to be pulled by
      // accumulatePointer's own for-await loop (unlike the single-chunk
      // 'pipes content' test above, where the whole pointer already sits in
      // the peeked head and that loop never runs).
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/asset.bin', { mode: '100644', id: 'blob-lfs' }]])
      )
      const body = Buffer.from('oid sha256:abc\nsize 3\n')
      fakeRepo.primitives.streamBlob.mockResolvedValue([LFS_MAGIC, body])
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/abc'
      )
      const lfsStream = new PassThrough()
      createReadStreamMocked.mockReturnValue(lfsStream as never)

      // Act
      const resultPromise = drain(
        sut.streamContent({ path: 'force-app/asset.bin', oid: 'HEAD' })
      )
      await new Promise(resolve => setImmediate(resolve))
      lfsStream.end(Buffer.from('lfs-content'))
      await resultPromise

      // Assert — a dropped chunk would leave the pointer short of `body`'s
      // bytes (zero-padded by Buffer.concat's explicit length instead).
      expect(getLFSObjectContentPathMocked).toHaveBeenCalledWith(
        Buffer.concat([LFS_MAGIC, body])
      )
    })

    it('When the resolved LFS object file errors while reading, Then the stream is destroyed with that error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig({ repo: '/repo' }))
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/asset.bin', { mode: '100644', id: 'blob-lfs' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([LFS_MAGIC])
      getLFSObjectContentPathMocked.mockReturnValue(
        '.git/lfs/objects/aa/bb/abc'
      )
      const lfsStream = new PassThrough()
      createReadStreamMocked.mockReturnValue(lfsStream as never)

      // Act
      const resultPromise = drain(
        sut.streamContent({ path: 'force-app/asset.bin', oid: 'HEAD' })
      )
      await new Promise(resolve => setImmediate(resolve))
      lfsStream.destroy(new Error('lfs object read failed'))

      // Assert
      await expect(resultPromise).rejects.toThrow('lfs object read failed')
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

    it('When streaming an archive entry, Then Readable.from is invoked in binary (non-object) mode', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.streamBlob.mockResolvedValue([
        Buffer.from('archived'),
      ])
      const fromSpy = vi.spyOn(Readable, 'from')

      // Act
      await collect(sut.streamArchive('force-app', 'HEAD'))

      // Assert
      expect(fromSpy).toHaveBeenCalledWith(expect.anything(), {
        objectMode: false,
      })
      fromSpy.mockRestore()
    })
  })

  describe('Given grepUnderPaths', () => {
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
      const result = await sut.grepUnderPaths('needle', 'force-app', 'HEAD')

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
      const result = await sut.grepUnderPaths('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('When the path is a literal, Then out-of-scope files are never read', async () => {
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
      const result = await sut.grepUnderPaths('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
      expect(fakeRepo.primitives.readBlob).not.toHaveBeenCalledWith('blob-c')
    })

    it('When the underlying read fails, Then the error is swallowed and an empty array is returned', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('grep boom'))

      // Act
      const result = await sut.grepUnderPaths('needle', 'force-app', 'HEAD')

      // Assert
      expect(result).toEqual([])
    })

    it('When the underlying read fails, Then it logs the grep failure with the pattern, path, revision and the underlying error message', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockRejectedValue(new Error('grep boom'))

      // Act
      await sut.grepUnderPaths('needle', 'force-app', 'HEAD')

      // Assert
      expect(resolveLazyCall(Logger.debug)).toBe(
        "grepBlobs: grep for 'needle' in 'force-app' at 'HEAD' failed: grep boom"
      )
    })
  })

  describe('Given grepMatchingPathspecs (buildPathspecMatcher)', () => {
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
        const result = await sut.grepMatchingPathspecs(
          'match-me',
          pathspec,
          'HEAD'
        )

        // Assert
        expect(result.sort()).toEqual([...expected].sort())
      }
    )

    it('When multiple pathspecs mix literal and glob forms, Then both kinds match', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())

      // Act
      const result = await sut.grepMatchingPathspecs(
        'match-me',
        ['other', 'force-app/*.cls'],
        'HEAD'
      )

      // Assert
      expect(result.sort()).toEqual(
        ['force-app/foo.cls', 'force-app/sub/bar.cls', 'other/baz.cls'].sort()
      )
    })

    it('When a pathspec has multiple leading "./" segments, Then all of them are normalized away', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'any',
        content: new Uint8Array(Buffer.from('needle')),
      })

      // Act
      const result = await sut.grepMatchingPathspecs(
        'needle',
        './././force-app',
        'HEAD'
      )

      // Assert
      expect(result).toEqual(['force-app/foo.cls'])
    })

    it('When a pathspec has multiple leading slashes, Then all of them are normalized away', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([['force-app/foo.cls', { mode: '100644', id: 'blob-1' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'any',
        content: new Uint8Array(Buffer.from('needle')),
      })

      // Act
      const result = await sut.grepMatchingPathspecs(
        'needle',
        '///force-app',
        'HEAD'
      )

      // Assert
      expect(result).toEqual(['force-app/foo.cls'])
    })

    it('When a pathspec contains "./" that is not a leading segment, Then only the leading occurrence is eligible for stripping', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([
          ['x./y/foo.cls', { mode: '100644', id: 'blob-1' }],
          ['xy/bar.cls', { mode: '100644', id: 'blob-2' }],
        ])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'any',
        content: new Uint8Array(Buffer.from('needle')),
      })

      // Act
      const result = await sut.grepMatchingPathspecs('needle', 'x./y', 'HEAD')

      // Assert — the embedded './' is left untouched (only a LEADING './'
      // is normalized), so the literal pathspec stays 'x./y'
      expect(result).toEqual(['x./y/foo.cls'])
    })
  })

  describe('Given grepUnderPaths matching a concrete path containing "["', () => {
    it('When the path is an object folder literally named "Custom[1]__c", Then the file is matched (previously silently degraded to an empty array)', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      const bracketedPath =
        'force-app/main/default/objects/Custom[1]__c/fields/X.field-meta.xml'
      fakeRepo.revParse.mockResolvedValue('commit-oid')
      fakeRepo.primitives.readObject.mockResolvedValue(asCommit('tree-oid'))
      fakeRepo.primitives.flattenTree.mockResolvedValue(
        flatten([[bracketedPath, { mode: '100644', id: 'blob-bracket' }]])
      )
      fakeRepo.primitives.readBlob.mockResolvedValue({
        type: 'blob',
        id: 'blob-bracket',
        content: new Uint8Array(Buffer.from(MASTER_DETAIL_TAG)),
      })

      // Act
      const result = await sut.grepUnderPaths(
        MASTER_DETAIL_TAG,
        'force-app/main/default/objects/Custom[1]__c/fields',
        'HEAD'
      )

      // Assert
      expect(result).toEqual([bracketedPath])
    })
  })

  describe('Given grepUnderPaths behaviour identity for glob-free concrete paths', () => {
    const paths = [
      'force-app/foo.cls',
      'force-app/sub/bar.cls',
      'other/baz.cls',
      'force-app-legacy/legacy.cls',
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
      ['other', ['other/baz.cls']],
      ['force-app', ['force-app/foo.cls', 'force-app/sub/bar.cls']],
      ['force-app/foo.cls', ['force-app/foo.cls']],
    ])(
      'When the concrete path is %s, Then the matched files are %s (same set as pathspec matching for the equivalent glob-free value, and never the prefix-colliding sibling)',
      async (path, expected) => {
        // Arrange
        const sut = GitAdapter.getInstance(makeConfig())

        // Act
        const result = await sut.grepUnderPaths('match-me', path, 'HEAD')

        // Assert
        expect(result.sort()).toEqual([...expected].sort())
      }
    )
  })

  // getFilesPath/pathExists/listDirAtRevision-shaped lookups now live on
  // TreeIndex itself (getFilesPath, pathExists, listChildren) — see
  // treeIndex.test.ts. GitAdapter's own contract here ends at
  // buildTreeIndex (see 'Given buildTreeIndex' above): it returns a
  // TreeIndex, or undefined on failure, and no longer answers path
  // questions on the caller's behalf.

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
        expect.objectContaining({ detectRenames: false, recursive: true })
      )
    })

    it('When changesManifest is configured, Then rename detection is requested as true', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut, sourceDirs('force-app'), {
        ...DEFAULT_DIFF_SPEC,
        detectRenames: true,
      })

      // Assert
      expect(fakeRepo.diff).toHaveBeenCalledWith(
        expect.objectContaining({ detectRenames: true })
      )
    })

    it('When ignoreWhitespace is enabled, Then the whitespace options are passed to repo.diff', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut, sourceDirs('force-app'), {
        ...DEFAULT_DIFF_SPEC,
        ignoreWhitespace: true,
      })

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
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await streamDiff(sut)

      // Assert
      const callArgs = fakeRepo.diff.mock.calls[0]?.[0]
      expect(callArgs).not.toHaveProperty('ignoreWhitespace')
      expect(callArgs).not.toHaveProperty('ignoreBlankLines')
    })

    it('When source scopes include a ROOT_PATHS entry alongside a non-root scope, Then the root entry unions and keeps changes outside the non-root scope', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('.', 'force-app') })
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
      const result = await streamDiff(sut, sourceDirs('.', 'force-app'))

      // Assert — git unions pathspecs (`-- . src` matches everything), so
      // 'other/Unrelated.cls' stays in scope even though it is outside
      // 'force-app': the root entry must not be stripped away.
      expect(result).toEqual(['A\tother/Unrelated.cls'])
    })

    it('When repo.diff rejects with a raw tsgit error, Then streamDiffLines rejects with the mapped error', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      fakeRepo.diff.mockRejectedValue(
        Object.assign(new Error('object not found: HEAD~1'), {
          code: 'OBJECT_NOT_FOUND',
        })
      )

      // Act
      const error = await streamDiff(sut).catch((thrown: unknown) => thrown)

      // Assert
      expect((error as Error).message).toBe(
        'HEAD~1..HEAD: not a valid git revision'
      )
      expect((error as Error).message).not.toContain('OBJECT_NOT_FOUND')
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
        'add in scope when only one of several configured scopes matches',
        change.add(),
        ['other', 'force-app'],
        ['A\tforce-app/New.cls'],
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
        const sut = GitAdapter.getInstance(
          makeConfig({ source: sourceDirs(...source) })
        )
        fakeRepo.diff.mockResolvedValue({ changes: [diffChange] })

        // Act
        const result = await streamDiff(sut, sourceDirs(...source))

        // Assert
        expect(result).toEqual(expected)
      }
    )
  })

  describe('Given streamDiffLines verdict bookkeeping', () => {
    it('When two in-scope changes each yield one line, Then verdict.linesYielded counts up to 2 (not down)', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(makeConfig())
      const verdict = freshVerdict()
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'force-app/A.cls',
            newId: 'oid-a',
            newMode: '100644',
          },
          {
            type: 'add',
            newPath: 'force-app/B.cls',
            newId: 'oid-b',
            newMode: '100644',
          },
        ],
      })

      // Act
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('force-app'),
        })
      )

      // Assert
      expect(verdict.linesYielded).toBe(2)
    })
  })

  describe('Given getUnmatchedSourceScopes', () => {
    it('Given a freshly created verdict, When getUnmatchedSourceScopes is called before any drain, Then it returns an empty array', () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app') })
      )

      // Act & Assert
      expect(
        sut.getUnmatchedSourceScopes(freshVerdict(), sourceDirs('force-app'))
      ).toEqual([])
    })

    it('When changes are present but none is in scope, Then it returns the non-root scopes', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app') })
      )
      const verdict = freshVerdict()
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
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('force-app'),
        })
      )

      // Assert
      expect(
        sut.getUnmatchedSourceScopes(verdict, sourceDirs('force-app'))
      ).toEqual(['force-app'])
    })

    it('When at least one change is in scope, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app') })
      )
      const verdict = freshVerdict()
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'force-app/New.cls',
            newId: 'oid',
            newMode: '100644',
          },
        ],
      })

      // Act
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('force-app'),
        })
      )

      // Assert
      expect(
        sut.getUnmatchedSourceScopes(verdict, sourceDirs('force-app'))
      ).toEqual([])
    })

    it('When there are no changes at all, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app') })
      )
      const verdict = freshVerdict()
      fakeRepo.diff.mockResolvedValue({ changes: [] })

      // Act
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('force-app'),
        })
      )

      // Assert
      expect(
        sut.getUnmatchedSourceScopes(verdict, sourceDirs('force-app'))
      ).toEqual([])
    })

    it('When the only configured scope is root, Then it returns an empty array even though no change is in scope', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('.') })
      )
      const verdict = freshVerdict()
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
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('.'),
        })
      )

      // Assert
      expect(sut.getUnmatchedSourceScopes(verdict, sourceDirs('.'))).toEqual([])
    })

    it('When configured scopes mix a root entry with an unmatched non-root entry, Then the root entry suppresses the warning', async () => {
      // Arrange — the change is a gitlink-only diff: keepSide filters it
      // out via the GITLINK_MODE check regardless of scope, so
      // linesYielded stays 0 even though the root scope would otherwise
      // put a normal path in scope. This isolates the guard: without it,
      // getUnmatchedSourceScopes would report 'force-app' as unmatched
      // (changesSeen > 0, linesYielded === 0) — the guard must be the
      // sole reason the result is [].
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('.', 'force-app') })
      )
      const verdict = freshVerdict()
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'vendor/submodule',
            newId: 'oid',
            newMode: '160000',
          },
        ],
      })

      // Act
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('.', 'force-app'),
        })
      )

      // Assert
      expect(
        sut.getUnmatchedSourceScopes(verdict, sourceDirs('.', 'force-app'))
      ).toEqual([])
    })

    it('When two non-root scopes are configured and one of them matches, Then it returns an empty array', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app', 'other') })
      )
      const verdict = freshVerdict()
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'force-app/New.cls',
            newId: 'oid',
            newMode: '100644',
          },
        ],
      })

      // Act
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('force-app', 'other'),
        })
      )

      // Assert
      expect(
        sut.getUnmatchedSourceScopes(verdict, sourceDirs('force-app', 'other'))
      ).toEqual([])
    })

    it('When two non-root scopes are configured and neither matches, Then it returns both scopes', async () => {
      // Arrange
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app', 'other') })
      )
      const verdict = freshVerdict()
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'unrelated/New.cls',
            newId: 'oid',
            newMode: '100644',
          },
        ],
      })

      // Act
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict,
          scopes: sourceDirs('force-app', 'other'),
        })
      )

      // Assert
      expect(
        sut.getUnmatchedSourceScopes(verdict, sourceDirs('force-app', 'other'))
      ).toEqual(['force-app', 'other'])
    })

    it('Given two independent verdicts against the same cached instance, When only one is drained, Then the other verdict is untouched', async () => {
      // Arrange — two GitAdapter.getInstance() callers with the same repo
      // share one cached instance; each must own its own verdict.
      const sut = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app') })
      )
      const drainedVerdict = freshVerdict()
      const untouchedVerdict = freshVerdict()
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
      await collect(
        sut.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict: drainedVerdict,
          scopes: sourceDirs('force-app'),
        })
      )

      // Assert
      expect(drainedVerdict).toEqual({ changesSeen: 1, linesYielded: 0 })
      expect(untouchedVerdict).toEqual({ changesSeen: 0, linesYielded: 0 })
    })

    it('Given two callers configure different source scopes but share a cached instance (same repo), When each drains its own verdict against its own scopes, Then getUnmatchedSourceScopes evaluates each caller against the scopes it passed in rather than the config that first created the instance', async () => {
      // Arrange — caller A creates the cached instance with source
      // ['force-app']; caller B resolves to the SAME cache key (repo only —
      // GitAdapter carries no other config) but configures a different
      // scope. GitAdapter never reads scope off shared state, so caller B's
      // evaluation must use its own scope instead of caller A's.
      const sutA = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('force-app') })
      )
      const sutB = GitAdapter.getInstance(
        makeConfig({ source: sourceDirs('other') })
      )
      expect(sutB).toBe(sutA)

      const verdictA = freshVerdict()
      const verdictB = freshVerdict()
      fakeRepo.diff.mockResolvedValue({
        changes: [
          {
            type: 'add',
            newPath: 'force-app/A.cls',
            newId: 'oid',
            newMode: '100644',
          },
        ],
      })

      // Act
      await collect(
        sutA.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict: verdictA,
          scopes: sourceDirs('force-app'),
        })
      )
      await collect(
        sutB.streamDiffLines({
          spec: DEFAULT_DIFF_SPEC,
          verdict: verdictB,
          scopes: sourceDirs('other'),
        })
      )

      // Assert — caller A's scope matched the only change; caller B's
      // scope ('other') never matches 'force-app/A.cls', so it must be
      // reported as unmatched against caller B's OWN scope.
      expect(
        sutA.getUnmatchedSourceScopes(verdictA, sourceDirs('force-app'))
      ).toEqual([])
      expect(
        sutB.getUnmatchedSourceScopes(verdictB, sourceDirs('other'))
      ).toEqual(['other'])
    })
  })
})
