'use strict'
import { PassThrough, Writable } from 'node:stream'

import { outputFile } from 'fs-extra'
import type { Ignore } from 'ignore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))
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
      mockGetBufferContent.mockResolvedValue(Buffer.from('class content'))

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetBufferContent).toHaveBeenCalledWith({
        path: 'classes/MyClass.cls',
        oid: 'abc123',
      })
      expect(outputFile).toHaveBeenCalledWith(
        'output/classes/MyClass.cls',
        Buffer.from('class content')
      )
    })
  })

  describe('Given a ComputedContent operation', () => {
    it('When executed, Then writes content directly to output', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const executor = new IOExecutor(work.config)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.ComputedContent,
          path: 'labels/CustomLabels.labels',
          content: '<xml>label content</xml>',
        },
      ])

      // Assert
      expect(outputFile).toHaveBeenCalledWith(
        'output/labels/CustomLabels.labels',
        '<xml>label content</xml>'
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
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))
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
      expect(mockGetBufferContent).toHaveBeenCalledTimes(1)
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
      mockGetBufferContent.mockRejectedValue(new Error('git error'))

      // Act & Assert (should not throw)
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/BadClass.cls',
          revision: 'abc123',
        },
      ])

      expect(mockGetBufferContent).toHaveBeenCalled()
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
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))

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
      mockGetBufferContent.mockResolvedValue(Buffer.from('content'))

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

  describe('Given a ComputedContent operation', () => {
    it('When executed, Then writes to joined output path', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'my-output'
      const executor = new IOExecutor(work.config)

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.ComputedContent,
          path: 'labels/CustomLabels.labels',
          content: '<xml/>',
        },
      ])

      // Assert
      expect(outputFile).toHaveBeenCalledWith(
        'my-output/labels/CustomLabels.labels',
        '<xml/>'
      )
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

    it('When ComputedContent precedes StreamedContent for the same path, Then the streamed writer is silently dropped', async () => {
      // Arrange
      const work = getWork()
      work.config.output = 'output'
      const sut = new IOExecutor(work.config)
      const writer = vi.fn()

      // Act
      await sut.execute([
        {
          kind: CopyOperationKind.ComputedContent,
          path: 'labels/CustomLabels.labels',
          content: '<xml/>',
        },
        {
          kind: CopyOperationKind.StreamedContent,
          path: 'labels/CustomLabels.labels',
          writer,
        },
      ])

      // Assert
      expect(outputFile).toHaveBeenCalledTimes(1)
      expect(writer).not.toHaveBeenCalled()
    })
  })
})
