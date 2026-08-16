'use strict'
import { PassThrough, Readable, Writable } from 'node:stream'

import type { Ignore } from 'ignore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EscalateToStreamingSignal } from '../../../../src/adapter/gitBlobReader'
import type { TreeIndexes } from '../../../../src/adapter/gitTreeLister'
import IOExecutor from '../../../../src/adapter/ioExecutor'
import type { CopyOperation } from '../../../../src/types/handlerResult'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
import { outputFile } from '../../../../src/utils/fsUtils'
import {
  buildIgnoreHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/testWork'

const { mockCreateWriteStream, mockMkdir, mockRename, mockUnlink } = vi.hoisted(
  () => ({
    mockCreateWriteStream: vi.fn(),
    mockMkdir: vi.fn<() => Promise<void>>(),
    mockRename: vi.fn<(src: string, dst: string) => Promise<void>>(),
    mockUnlink: vi.fn<(p: string) => Promise<void>>(),
  })
)

vi.mock('node:fs', async () => {
  const actual: typeof import('node:fs') = await vi.importActual('node:fs')
  return {
    ...actual,
    createWriteStream: mockCreateWriteStream,
    promises: {
      ...actual.promises,
      mkdir: mockMkdir,
      rename: mockRename,
      unlink: mockUnlink,
    },
  }
})

vi.mock('../../../../src/utils/fsUtils', async orig => ({
  ...(await orig<typeof import('../../../../src/utils/fsUtils')>()),
  outputFile: vi.fn(),
}))

vi.mock('../../../../src/utils/ignoreHelper')

vi.mock('../../../../src/utils/LoggingService')

const mockBuildIgnoreHelper = vi.mocked(buildIgnoreHelper)

const mockGetBufferContent =
  vi.fn<(forRef: { path: string; oid: string }) => Promise<Buffer>>()
const mockGetBufferContentOrEscalate =
  vi.fn<(forRef: { path: string; oid: string }) => Promise<Buffer>>()
const mockStreamContent = vi.fn()
const mockGetInstance = vi.fn()
vi.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: (...args: unknown[]) => mockGetInstance(...args),
    },
  }
})

// getFilesPath moved off GitAdapter onto the run-owned TreeIndexes holder:
// IOExecutor now takes it as its own collaborator (2nd ctor arg), separate
// from the blob reader. mockAt stands in for the holder's per-revision
// lookup, so tests can assert both which revision was asked for and what
// the resolved TreeIndex was asked to enumerate.
const mockGetFilesPath = vi.fn<(path: string) => string[]>()
const mockAt = vi.fn(() => ({ getFilesPath: mockGetFilesPath }))
const treeIndexes = { at: mockAt } as unknown as TreeIndexes

beforeEach(() => {
  vi.clearAllMocks()
  mockGetInstance.mockReturnValue({
    getBufferContent: mockGetBufferContent,
    getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
    streamContent: mockStreamContent,
  })
  mockBuildIgnoreHelper.mockResolvedValue({
    globalIgnore: {
      ignores: () => false,
    } as unknown as Ignore,
  } as unknown as IgnoreHelper)
  mockMkdir.mockResolvedValue()
  mockRename.mockResolvedValue()
  mockUnlink.mockResolvedValue()
  mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
})

type FakeWriteStream = Writable & {
  written: Buffer[]
  destroyed: boolean
}

const createFakeWriteStream = (): FakeWriteStream => {
  const stream = new PassThrough() as unknown as FakeWriteStream
  stream.written = []
  stream.destroyed = false
  stream.on('data', chunk => stream.written.push(Buffer.from(chunk)))
  const originalDestroy = stream.destroy.bind(stream)
  stream.destroy = (err?: Error) => {
    stream.destroyed = true
    return originalDestroy(err)
  }
  return stream
}

describe('IOExecutor', () => {
  describe('Given generateDelta is false', () => {
    it('When execute is called with copies, Then still processes them', async () => {
      // Arrange
      const work = getWork()
      work.config.generateDelta = false
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('content'))
      const copies: CopyOperation[] = [
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ]

      // Act
      await executor.execute(copies)

      // Assert
      expect(mockGetFilesPath).not.toHaveBeenCalled()
      expect(outputFile).toHaveBeenCalled()
    })
  })

  describe('Given a GitCopy operation', () => {
    it('When executed, Then copies files from git to output', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockResolvedValue(
        Buffer.from('class content')
      )

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContentOrEscalate).toHaveBeenCalledWith({
        path: 'classes/MyClass.cls',
        oid: 'abc123',
      })
      expect(outputFile).toHaveBeenCalledWith(
        'output/classes/MyClass.cls',
        Buffer.from('class content')
      )
    })
  })

  describe('Given a GitCopy operation whose path escapes the output directory', () => {
    it('When executed, Then the copy is skipped before any content read', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: '../escape.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContentOrEscalate).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitCopy operation resolving to a sibling of the output directory', () => {
    it('When executed, Then the sibling-prefixed destination is rejected', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: '../outputX/escape.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContentOrEscalate).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given the output directory is the current directory', () => {
    it('When an in-bound copy executes, Then it is written (dot output stays functional)', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = '.'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(outputFile).toHaveBeenCalledWith(
        'classes/MyClass.cls',
        Buffer.from('content')
      )
    })
  })

  describe('Given a GitDirCopy child path that escapes the output directory', () => {
    it('When executed, Then that child is skipped and in-bound children still copy', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetFilesPath.mockReturnValue(['../escape.cls', 'objects/Kept.cls'])
      mockGetBufferContent.mockResolvedValue(Buffer.from('kept'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'objects',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContent).toHaveBeenCalledTimes(1)
      expect(outputFile).toHaveBeenCalledWith(
        'output/objects/Kept.cls',
        Buffer.from('kept')
      )
    })
  })

  describe('Given duplicate paths', () => {
    it('When executed, Then deduplicates by path', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('content'))
      const copies: CopyOperation[] = [
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ]

      // Act
      await executor.execute(copies)

      // Assert
      expect(mockGetBufferContentOrEscalate).toHaveBeenCalledTimes(1)
    })
  })

  describe('Given an ignored path', () => {
    it('When executed, Then skips the operation', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockBuildIgnoreHelper.mockResolvedValue({
        globalIgnore: {
          ignores: () => true,
        } as unknown as Ignore,
      } as unknown as IgnoreHelper)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'ignored/file.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetFilesPath).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitCopy operation that fails', () => {
    it('When executed, Then logs the error and continues', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockRejectedValue(new Error('git error'))

      // Act & Assert (should not throw)
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/BadClass.cls',
          revision: 'abc123',
        },
      ])

      expect(mockGetBufferContentOrEscalate).toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitCopy operation with a different revision than config.to', () => {
    it('When executed, Then the ref carries op.revision and GitAdapter.getInstance is still called with the unmodified config', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'different-sha',
        },
      ])

      // Assert — the revision travels through the FileGitRef passed to the
      // blob reader, not through a rebuilt GitAdapter instance.
      expect(mockGetBufferContentOrEscalate).toHaveBeenCalledWith({
        path: 'classes/MyClass.cls',
        oid: 'different-sha',
      })
      expect(mockGetInstance).toHaveBeenCalledTimes(1)
      expect(mockGetInstance).toHaveBeenCalledWith(work.config)
    })
  })

  describe('Given a GitCopy operation with same revision as config.to', () => {
    it('When executed, Then calls GitAdapter.getInstance with original config', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetInstance).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'abc123' })
      )
    })
  })

  describe('Given a GitDirCopy operation (directory)', () => {
    it('When executed, Then enumerates files via getFilesPath and copies each', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetFilesPath.mockReturnValue([
        'permissionsets/MyPS/file1.xml',
        'permissionsets/MyPS/file2.xml',
      ])
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockAt).toHaveBeenCalledWith('abc123')
      expect(mockGetFilesPath).toHaveBeenCalledWith('permissionsets/MyPS')
      expect(mockGetBufferContent).toHaveBeenCalledTimes(2)
      expect(outputFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('Given a GitDirCopy operation whose revision has no built tree index', () => {
    it('When executed, Then no files are copied (degrades to empty, not a throw)', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, {
        at: () => undefined,
      } as unknown as TreeIndexes)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContent).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitDirCopy operation with a different revision than config.to', () => {
    it('When executed, Then getFilesPath is called with (op.path, op.revision) and GitAdapter.getInstance is called exactly once with the unmodified config', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetFilesPath.mockReturnValue(['permissionsets/MyPS/file1.xml'])
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'different-sha',
        },
      ])

      // Assert — the revision travels through the op, not through a
      // rebuilt GitAdapter instance: getInstance is called exactly once,
      // at construction, with the unmodified config.
      expect(mockAt).toHaveBeenCalledWith('different-sha')
      expect(mockGetFilesPath).toHaveBeenCalledWith('permissionsets/MyPS')
      expect(mockGetInstance).toHaveBeenCalledTimes(1)
      expect(mockGetInstance).toHaveBeenCalledWith(work.config)
    })
  })

  describe('Given a GitDirCopy operation that fails', () => {
    it('When executed, Then logs the error and continues', async () => {
      // Arrange — the failure is triggered from getBufferContent (real git
      // blob I/O, genuinely throwing/rejecting), not from getFilesPath: the
      // latter is a pure synchronous TreeIndex trie walk that cannot throw,
      // so pinning the catch-and-log behavior through it would test an
      // unreachable path. getBufferContent is a real throw source the same
      // try/catch also guards.
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetFilesPath.mockReturnValue(['permissionsets/MyPS/file1.xml'])
      mockGetBufferContent.mockRejectedValue(new Error('dir error'))

      // Act & Assert (should not throw)
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'abc123',
        },
      ])

      expect(mockGetFilesPath).toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitDirCopy operation with ignored child files', () => {
    it('When executed, Then skips ignored child files', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetFilesPath.mockReturnValue([
        'permissionsets/MyPS/kept.xml',
        'permissionsets/MyPS/ignored.xml',
      ])
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))
      mockBuildIgnoreHelper.mockResolvedValue({
        globalIgnore: {
          ignores: (path: string) => path.includes('ignored'),
        } as unknown as Ignore,
      } as unknown as IgnoreHelper)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContent).toHaveBeenCalledTimes(1)
      expect(outputFile).toHaveBeenCalledTimes(1)
      expect(outputFile).toHaveBeenCalledWith(
        'output/permissionsets/MyPS/kept.xml',
        Buffer.from('content')
      )
    })
  })

  describe('Given an empty copies array', () => {
    it('When executed, Then does nothing', async () => {
      // Arrange
      const work = getWork()
      const executor = new IOExecutor(work.config, treeIndexes)

      // Act
      await executor.execute([])

      // Assert
      expect(mockGetFilesPath).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitDirCopy that marks child paths as processed', () => {
    it('When followed by another GitDirCopy for the same path, Then second call is skipped', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config, treeIndexes)
      mockGetFilesPath.mockReturnValue(['permissionsets/MyPS/file1.xml'])
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'abc123',
        },
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'abc123',
        },
      ])

      // Assert - second GitDirCopy is skipped because path is already processed
      expect(mockGetFilesPath).toHaveBeenCalledTimes(1)
    })
  })

  describe('Given a StreamedContent operation', () => {
    it('When executed, Then writes via sibling tmp and renames on success', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const stream = createFakeWriteStream()
      mockCreateWriteStream.mockReturnValueOnce(stream)
      const sut = new IOExecutor(work.config, treeIndexes)
      const writer = vi.fn(async (out: Writable) => {
        out.write('<Root></Root>')
      })

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.StreamedContent,
          path: 'profiles/Admin.profile-meta.xml',
          writer,
        },
      ])

      // Assert
      expect(writer).toHaveBeenCalledWith(stream)
      expect(mockCreateWriteStream).toHaveBeenCalledWith(
        'output/profiles/Admin.profile-meta.xml.tmp'
      )
      expect(mockMkdir).toHaveBeenCalledWith('output/profiles', {
        recursive: true,
      })
      expect(mockRename).toHaveBeenCalledWith(
        'output/profiles/Admin.profile-meta.xml.tmp',
        'output/profiles/Admin.profile-meta.xml'
      )
      expect(mockUnlink).not.toHaveBeenCalled()
    })

    it('When writer throws mid-emit, Then tmp is unlinked and rename is not invoked', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const stream = createFakeWriteStream()
      mockCreateWriteStream.mockReturnValueOnce(stream)
      const sut = new IOExecutor(work.config, treeIndexes)
      const writer = vi.fn(async () => {
        throw new Error('producer failed')
      })

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.StreamedContent,
          path: 'labels/CustomLabels.labels',
          writer,
        },
      ])

      // Assert
      expect(mockRename).not.toHaveBeenCalled()
      expect(mockUnlink).toHaveBeenCalledWith(
        'output/labels/CustomLabels.labels.tmp'
      )
      expect(stream.destroyed).toBe(true)
    })

    it('When path is ignored, Then the writer is never invoked', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      mockBuildIgnoreHelper.mockResolvedValue({
        globalIgnore: {
          ignores: () => true,
        } as unknown as Ignore,
      } as unknown as IgnoreHelper)
      const sut = new IOExecutor(work.config, treeIndexes)
      const writer = vi.fn()

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.StreamedContent,
          path: 'ignored/foo.xml',
          writer,
        },
      ])

      // Assert
      expect(writer).not.toHaveBeenCalled()
      expect(mockCreateWriteStream).not.toHaveBeenCalled()
    })

    it('When the path escapes the output directory, Then the writer is never invoked (zip-slip guard, same as the other copy paths)', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const sut = new IOExecutor(work.config, treeIndexes)
      const writer = vi.fn()

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.StreamedContent,
          path: '../escape.labels',
          writer,
        },
      ])

      // Assert
      expect(writer).not.toHaveBeenCalled()
      expect(mockCreateWriteStream).not.toHaveBeenCalled()
    })

    it('When two StreamedContent ops target the same path, Then only the first writer fires (per-path dedup via processedPaths)', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const stream = createFakeWriteStream()
      mockCreateWriteStream.mockReturnValueOnce(stream)
      const sut = new IOExecutor(work.config, treeIndexes)
      const firstWriter = vi.fn(async (out: Writable) => {
        out.write('<first/>')
      })
      const secondWriter = vi.fn()

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.StreamedContent,
          path: 'labels/CustomLabels.labels',
          writer: firstWriter,
        },
        {
          kind: CopyOperationKind.StreamedContent,
          path: 'labels/CustomLabels.labels',
          writer: secondWriter,
        },
      ])

      // Assert
      expect(firstWriter).toHaveBeenCalledTimes(1)
      expect(secondWriter).not.toHaveBeenCalled()
    })
  })

  describe('Given exactly GIT_ARCHIVE_DIR_THRESHOLD files in a dir (EqualityOperator kill, L134)', () => {
    it('When filePaths.length equals threshold (25), Then uses per-file copy, not streamArchive', async () => {
      // Arrange — 25 paths == threshold; ">" means 25 does NOT trigger archive, ">=" would
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const filePaths = Array.from({ length: 25 }, (_, i) => `bundle/f${i}.xml`)
      mockGetFilesPath.mockReturnValue(filePaths)
      mockGetBufferContent.mockResolvedValue(Buffer.from('x'))
      const streamArchiveSpy = vi.fn(async function* () {})
      mockGetInstance.mockReturnValue({
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      const sut = new IOExecutor(work.config, treeIndexes)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — ">": 25 is NOT > 25, so per-file path taken
      expect(streamArchiveSpy).not.toHaveBeenCalled()
      expect(mockGetBufferContent).toHaveBeenCalledTimes(25)
    })

    it('When filePaths.length exceeds threshold (26), Then uses streamArchive', async () => {
      // Arrange — 26 paths > 25 threshold → archive path
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const filePaths = Array.from({ length: 26 }, (_, i) => `bundle/f${i}.xml`)
      mockGetFilesPath.mockReturnValue(filePaths)
      const streamArchiveSpy = vi.fn(async function* () {
        for (const path of filePaths) {
          yield { path, stream: Readable.from([Buffer.from('x')]) }
        }
      })
      mockGetInstance.mockReturnValue({
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
      const sut = new IOExecutor(work.config, treeIndexes)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(streamArchiveSpy).toHaveBeenCalledWith('bundle', 'abc123')
      expect(mockGetBufferContent).not.toHaveBeenCalled()
    })
  })

  describe('Given a GitDirCopy with per-file copy (kills L142:59 ObjectLiteral {})', () => {
    it('When copying files, Then getBufferContent is called with correct path and oid', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      mockGetFilesPath.mockReturnValue(['classes/Foo.cls'])
      mockGetBufferContent.mockResolvedValue(Buffer.from('class Foo {}'))
      const sut = new IOExecutor(work.config, treeIndexes)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'classes',
          revision: 'abc123',
        },
      ])

      // Assert — kills ObjectLiteral {} replacing { path, oid }
      expect(mockGetBufferContent).toHaveBeenCalledWith({
        path: 'classes/Foo.cls',
        oid: 'abc123',
      })
    })
  })

  describe('Given _executeGitDirCopyViaArchive path guards (kills L174/L178/L182/L191 ConditionalExpression false)', () => {
    const makeArchiveSut = (
      filePaths: string[],
      entries: Array<{ path: string }>
    ) => {
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      // >25 to trigger archive path
      mockGetFilesPath.mockReturnValue(filePaths)
      const streamArchiveSpy = vi.fn(async function* () {
        for (const entry of entries) {
          yield { path: entry.path, stream: Readable.from([Buffer.from('x')]) }
        }
      })
      mockGetInstance.mockReturnValue({
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
      return {
        sut: new IOExecutor(work.config, treeIndexes),
        streamArchiveSpy,
        work,
      }
    }

    const makeFilePaths = (n: number, prefix = 'bundle') =>
      Array.from({ length: n }, (_, i) => `${prefix}/f${i}.xml`)

    it('When archive yields entry not in wanted set, Then it is skipped (L174 kills false guard)', async () => {
      // Arrange — 26 known files but archive yields an extra unknown entry
      const knownPaths = makeFilePaths(26)
      const { sut } = makeArchiveSut(knownPaths, [
        { path: 'bundle/unknown-extra.xml' }, // not in wanted
        { path: knownPaths[0]! },
      ])

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — only the known entry triggers a write (not the unknown extra)
      expect(mockRename).toHaveBeenCalledTimes(1)
      expect(mockRename).toHaveBeenCalledWith(
        expect.stringContaining(knownPaths[0]!),
        expect.any(String)
      )
    })

    it('When archive yields already-processed entry, Then it is skipped (L178 kills false guard)', async () => {
      // Arrange — 26 files; first entry processed, then same path appears again
      const knownPaths = makeFilePaths(26)
      const firstPath = knownPaths[0]!
      const { sut } = makeArchiveSut(knownPaths, [
        { path: firstPath },
        { path: firstPath }, // duplicate
      ])

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — rename called only once despite duplicate entry
      expect(mockRename).toHaveBeenCalledTimes(1)
    })

    it('When archive yields ignored entry, Then it is skipped (L182 kills false guard)', async () => {
      // Arrange
      const knownPaths = makeFilePaths(26)
      mockBuildIgnoreHelper.mockResolvedValue({
        globalIgnore: {
          ignores: (p: string) => p.includes('f0.xml'),
        } as unknown as Ignore,
      } as unknown as IgnoreHelper)
      const { sut } = makeArchiveSut(knownPaths, [
        { path: knownPaths[0]! }, // ignored
        { path: knownPaths[1]! }, // not ignored
      ])

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — only non-ignored entry triggers rename
      expect(mockRename).toHaveBeenCalledTimes(1)
      expect(mockRename).toHaveBeenCalledWith(
        expect.stringContaining('f1.xml'),
        expect.any(String)
      )
    })

    it('When archive entry dst escapes outputPrefix (zip-slip), Then it is skipped (L191 kills false guard)', async () => {
      // Arrange — output without trailing slash is 'output'
      // A path like '../escape/evil.xml' would resolve to outside output/
      const knownPaths = [...makeFilePaths(25), '../escape/evil.xml']
      const { sut, work } = makeArchiveSut(knownPaths, [
        { path: '../escape/evil.xml' },
        { path: knownPaths[0]! },
      ])
      // Ensure output has no trailing slash
      work.config.output = 'output'

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — zip-slip entry skipped, only the safe entry written
      expect(mockRename).toHaveBeenCalledTimes(1)
      expect(mockRename).not.toHaveBeenCalledWith(
        expect.stringContaining('evil.xml'),
        expect.any(String)
      )
    })

    it('When archive entry is valid, Then _writeAtomicallyViaTmp is called and rename occurs (L196 kills BlockStatement {})', async () => {
      // Arrange
      const knownPaths = makeFilePaths(26)
      const { sut } = makeArchiveSut(knownPaths, [{ path: knownPaths[0]! }])

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — rename was invoked, proving _writeAtomicallyViaTmp ran
      expect(mockRename).toHaveBeenCalledWith(
        `output/${knownPaths[0]}.tmp`,
        `output/${knownPaths[0]}`
      )
    })

    it('When output already ends with slash, Then outputPrefix keeps it unchanged (kills L170 MethodExpression/StringLiteral)', async () => {
      // Arrange — output with trailing slash
      const knownPaths = makeFilePaths(26)
      const { sut, work } = makeArchiveSut(knownPaths, [
        { path: knownPaths[0]! },
      ])
      work.config.output = 'output/'

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert — file written, outputPrefix was 'output/' not 'output//'
      expect(mockRename).toHaveBeenCalledTimes(1)
    })
  })

  describe('Given L107 EscalateToStreamingSignal instanceof check', () => {
    it('When getBufferContentOrEscalate rejects with plain Error, Then tmp file is NOT created (no unlink)', async () => {
      // L107 mutant: `if (true)` instead of `if (error instanceof EscalateToStreamingSignal)`
      // With mutant: plain Error also triggers _streamCopyWithAtomicRename → tmp created → unlink
      // Real: plain Error → Logger.debug only, no tmp file, no unlink
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      mockGetBufferContentOrEscalate.mockRejectedValue(new Error('plain error'))
      const sut = new IOExecutor(work.config, treeIndexes)

      await sut.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/Foo.cls',
          revision: 'abc123',
        },
      ])

      // With real code: no tmp created, no unlink called
      expect(mockUnlink).not.toHaveBeenCalled()
      expect(mockRename).not.toHaveBeenCalled()
    })
  })

  describe('Given a large GitCopy blob that triggers escalation', () => {
    it('When getBufferContentOrEscalate rejects with EscalateToStreamingSignal, Then _streamCopyWithAtomicRename pipes into a sibling tmp and renames', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const fakeBlobReader = {
        getBufferContent: vi.fn(),
        getBufferContentOrEscalate: vi.fn(() =>
          Promise.reject(
            new EscalateToStreamingSignal(5_000_000, {
              oid: 'abc123',
              path: 'resources/big.bin',
            })
          )
        ),
        streamContent: vi.fn(() => Readable.from([Buffer.from('BIGBIG')])),
        streamArchive: vi.fn(async function* () {}),
      }
      const stream = createFakeWriteStream()
      mockCreateWriteStream.mockReturnValueOnce(stream)
      const sut = new IOExecutor(work.config, treeIndexes, fakeBlobReader)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'resources/big.bin',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(fakeBlobReader.streamContent).toHaveBeenCalledWith({
        oid: 'abc123',
        path: 'resources/big.bin',
      })
      expect(mockCreateWriteStream).toHaveBeenCalledWith(
        'output/resources/big.bin.tmp'
      )
      expect(mockRename).toHaveBeenCalledWith(
        'output/resources/big.bin.tmp',
        'output/resources/big.bin'
      )
    })

    it('Given a directory with more files than the git-archive threshold, When executed, Then streamArchive entries are piped via sibling tmp + rename', async () => {
      // Arrange — 30 paths above GIT_ARCHIVE_DIR_THRESHOLD (25)
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const filePaths = Array.from({ length: 30 }, (_, i) => `bundle/f${i}.xml`)
      mockGetFilesPath.mockReturnValue(filePaths)
      mockBuildIgnoreHelper.mockResolvedValue({
        globalIgnore: {
          ignores: () => false,
        } as unknown as Ignore,
      } as unknown as IgnoreHelper)
      const streamArchiveSpy = vi.fn(async function* () {
        for (const path of filePaths) {
          yield { path, stream: Readable.from([Buffer.from('x')]) }
        }
      })
      mockGetInstance.mockReturnValue({
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
      const sut = new IOExecutor(work.config, treeIndexes)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(streamArchiveSpy).toHaveBeenCalledWith('bundle', 'abc123')
      expect(mockGetBufferContent).not.toHaveBeenCalled()
      expect(mockRename).toHaveBeenCalledTimes(30)
    })

    it('When the streaming pipeline errors, Then the tmp file is unlinked and rename is not invoked', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const failingSource = new Readable({
        read() {
          this.destroy(new Error('git stream exploded'))
        },
      })
      const fakeBlobReader = {
        getBufferContent: vi.fn(),
        getBufferContentOrEscalate: vi.fn(() =>
          Promise.reject(
            new EscalateToStreamingSignal(5_000_000, {
              oid: 'abc123',
              path: 'resources/big.bin',
            })
          )
        ),
        streamContent: vi.fn(() => failingSource),
        streamArchive: vi.fn(async function* () {}),
      }
      const stream = createFakeWriteStream()
      mockCreateWriteStream.mockReturnValueOnce(stream)
      const sut = new IOExecutor(work.config, treeIndexes, fakeBlobReader)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'resources/big.bin',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockRename).not.toHaveBeenCalled()
      expect(mockUnlink).toHaveBeenCalledWith('output/resources/big.bin.tmp')
    })
  })
})
