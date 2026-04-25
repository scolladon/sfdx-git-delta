'use strict'
import { PassThrough, Readable, Writable } from 'node:stream'

import { outputFile } from 'fs-extra'
import type { Ignore } from 'ignore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EscalateToStreamingSignal } from '../../../../src/adapter/gitBlobReader'
import IOExecutor from '../../../../src/adapter/ioExecutor'
import type { CopyOperation } from '../../../../src/types/handlerResult'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
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

vi.mock('fs-extra')

vi.mock('../../../../src/utils/ignoreHelper')

vi.mock('../../../../src/utils/LoggingService')

const mockBuildIgnoreHelper = vi.mocked(buildIgnoreHelper)

const mockGetFilesPath = vi.fn<(path: string) => Promise<string[]>>()
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

beforeEach(() => {
  vi.clearAllMocks()
  mockGetInstance.mockReturnValue({
    getFilesPath: mockGetFilesPath,
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
      const executor = new IOExecutor(work.config)
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
      const executor = new IOExecutor(work.config)
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

  describe('Given duplicate paths', () => {
    it('When executed, Then deduplicates by path', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config)
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
      const executor = new IOExecutor(work.config)
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
      const executor = new IOExecutor(work.config)
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
    it('When executed, Then calls GitAdapter.getInstance with modified config', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config)
      mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'different-sha',
        },
      ])

      // Assert
      expect(mockGetInstance).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'different-sha' })
      )
    })
  })

  describe('Given a GitCopy operation with same revision as config.to', () => {
    it('When executed, Then calls GitAdapter.getInstance with original config', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config)
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
      const executor = new IOExecutor(work.config)
      mockGetFilesPath.mockResolvedValue([
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
      expect(mockGetFilesPath).toHaveBeenCalledWith('permissionsets/MyPS')
      expect(mockGetBufferContent).toHaveBeenCalledTimes(2)
      expect(outputFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('Given a GitDirCopy operation with a different revision than config.to', () => {
    it('When executed, Then calls GitAdapter.getInstance with modified config', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config)
      mockGetFilesPath.mockResolvedValue(['permissionsets/MyPS/file1.xml'])
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'permissionsets/MyPS',
          revision: 'different-sha',
        },
      ])

      // Assert
      expect(mockGetInstance).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'different-sha' })
      )
    })
  })

  describe('Given a GitDirCopy operation that fails', () => {
    it('When executed, Then logs the error and continues', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'abc123'
      work.config.output = 'output'
      const executor = new IOExecutor(work.config)
      mockGetFilesPath.mockRejectedValue(new Error('dir error'))

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
      const executor = new IOExecutor(work.config)
      mockGetFilesPath.mockResolvedValue([
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
      const executor = new IOExecutor(work.config)

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
      const executor = new IOExecutor(work.config)
      mockGetFilesPath.mockResolvedValue(['permissionsets/MyPS/file1.xml'])
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
      const sut = new IOExecutor(work.config)
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
      const sut = new IOExecutor(work.config)
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
      const sut = new IOExecutor(work.config)
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

    it('When two StreamedContent ops target the same path, Then only the first writer fires (per-path dedup via processedPaths)', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const stream = createFakeWriteStream()
      mockCreateWriteStream.mockReturnValueOnce(stream)
      const sut = new IOExecutor(work.config)
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
      mockGetFilesPath.mockResolvedValue(filePaths)
      mockGetBufferContent.mockResolvedValue(Buffer.from('x'))
      const streamArchiveSpy = vi.fn(async function* () {})
      mockGetInstance.mockReturnValue({
        getFilesPath: mockGetFilesPath,
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      const sut = new IOExecutor(work.config)

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
      mockGetFilesPath.mockResolvedValue(filePaths)
      const streamArchiveSpy = vi.fn(async function* () {
        for (const path of filePaths) {
          yield { path, stream: Readable.from([Buffer.from('x')]) }
        }
      })
      mockGetInstance.mockReturnValue({
        getFilesPath: mockGetFilesPath,
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
      const sut = new IOExecutor(work.config)

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
      mockGetFilesPath.mockResolvedValue(['classes/Foo.cls'])
      mockGetBufferContent.mockResolvedValue(Buffer.from('class Foo {}'))
      const sut = new IOExecutor(work.config)

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

  describe('Given a GitCopy with same revision as config.to (kills L47 ConditionalExpression true)', () => {
    it('When blobReaderForRevision is called with config.to, Then original config is used (not a spread)', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'rev-same'
      work.config.output = 'output'
      const capturedConfigs: unknown[] = []
      mockGetInstance.mockImplementation((cfg: unknown) => {
        capturedConfigs.push(cfg)
        return {
          getFilesPath: mockGetFilesPath,
          getBufferContent: mockGetBufferContent,
          getBufferContentOrEscalate:
            mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('ok')),
          streamContent: mockStreamContent,
          streamArchive: vi.fn(async function* () {}),
        }
      })
      const sut = new IOExecutor(work.config)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/Foo.cls',
          revision: 'rev-same',
        },
      ])

      // Assert — config passed to getInstance must have to='rev-same' (original, not spread)
      expect(capturedConfigs[0]).toBe(work.config)
    })

    it('When blobReaderForRevision is called with a different revision, Then a new config with that revision is used', async () => {
      // Arrange
      const work = getWork()
      work.config.to = 'rev-current'
      work.config.output = 'output'
      const capturedConfigs: unknown[] = []
      mockGetInstance.mockImplementation((cfg: unknown) => {
        capturedConfigs.push(cfg)
        return {
          getFilesPath: mockGetFilesPath,
          getBufferContent: mockGetBufferContent,
          getBufferContentOrEscalate:
            mockGetBufferContentOrEscalate.mockResolvedValue(Buffer.from('ok')),
          streamContent: mockStreamContent,
          streamArchive: vi.fn(async function* () {}),
        }
      })
      const sut = new IOExecutor(work.config)

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/Foo.cls',
          revision: 'rev-old',
        },
      ])

      // Assert — spread config with to='rev-old', not original config object
      expect(capturedConfigs[0]).not.toBe(work.config)
      expect(capturedConfigs[0]).toMatchObject({ to: 'rev-old' })
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
      mockGetFilesPath.mockResolvedValue(filePaths)
      const streamArchiveSpy = vi.fn(async function* () {
        for (const entry of entries) {
          yield { path: entry.path, stream: Readable.from([Buffer.from('x')]) }
        }
      })
      mockGetInstance.mockReturnValue({
        getFilesPath: mockGetFilesPath,
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
      return { sut: new IOExecutor(work.config), streamArchiveSpy, work }
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

  describe('Given L90 _getGitAdapter revision equality check', () => {
    it('When GitDirCopy revision equals config.to, Then GitAdapter.getInstance is called with the original config object (not a spread)', async () => {
      // L90 mutant: revision !== this.config.to → true (always spreads)
      // With mutant: getInstance always gets a spread (new object), so toBe(work.config) fails.
      const work = getWork()
      work.config.to = 'same-rev'
      work.config.output = 'output'
      const capturedConfigs: unknown[] = []
      mockGetInstance.mockImplementation((cfg: unknown) => {
        capturedConfigs.push(cfg)
        return {
          getFilesPath: mockGetFilesPath,
          getBufferContent: mockGetBufferContent.mockResolvedValue(
            Buffer.from('x')
          ),
          getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
          streamContent: mockStreamContent,
          streamArchive: vi.fn(async function* () {}),
        }
      })
      mockGetFilesPath.mockResolvedValue(['bundle/file.xml'])
      const sut = new IOExecutor(work.config)

      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'same-rev',
        },
      ])

      // The config passed to getInstance must be the original object (same reference)
      expect(capturedConfigs[0]).toBe(work.config)
    })

    it('When GitDirCopy revision differs from config.to, Then GitAdapter.getInstance is called with a spread (different object)', async () => {
      // L90 positive path: revision !== config.to → spread
      const work = getWork()
      work.config.to = 'current-rev'
      work.config.output = 'output'
      const capturedConfigs: unknown[] = []
      mockGetInstance.mockImplementation((cfg: unknown) => {
        capturedConfigs.push(cfg)
        return {
          getFilesPath: mockGetFilesPath,
          getBufferContent: mockGetBufferContent.mockResolvedValue(
            Buffer.from('x')
          ),
          getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
          streamContent: mockStreamContent,
          streamArchive: vi.fn(async function* () {}),
        }
      })
      mockGetFilesPath.mockResolvedValue(['bundle/file.xml'])
      const sut = new IOExecutor(work.config)

      await sut.execute([
        {
          kind: CopyOperationKind.GitDirCopy,
          path: 'bundle',
          revision: 'old-rev',
        },
      ])

      // Spread: different object, but with to='old-rev'
      expect(capturedConfigs[0]).not.toBe(work.config)
      expect(capturedConfigs[0]).toMatchObject({ to: 'old-rev' })
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
      const sut = new IOExecutor(work.config)

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
      const sut = new IOExecutor(work.config, () => fakeBlobReader)

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
      mockGetFilesPath.mockResolvedValue(filePaths)
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
        getFilesPath: mockGetFilesPath,
        getBufferContent: mockGetBufferContent,
        getBufferContentOrEscalate: mockGetBufferContentOrEscalate,
        streamContent: mockStreamContent,
        streamArchive: streamArchiveSpy,
      })
      mockCreateWriteStream.mockImplementation(() => createFakeWriteStream())
      const sut = new IOExecutor(work.config)

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
      const sut = new IOExecutor(work.config, () => fakeBlobReader)

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
