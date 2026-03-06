'use strict'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { outputFile } from 'fs-extra'
import type { Ignore } from 'ignore'
import IOExecutor from '../../../../src/service/ioExecutor'
import type { CopyOperation } from '../../../../src/types/handlerResult'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
import {
  buildIgnoreHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/testWork'

jest.mock('fs-extra')

jest.mock('../../../../src/utils/ignoreHelper')

jest.mock('../../../../src/utils/LoggingService')

const mockBuildIgnoreHelper = jest.mocked(buildIgnoreHelper)

const mockGetFilesPath = jest.fn<(path: string) => Promise<string[]>>()
const mockGetBufferContent =
  jest.fn<(forRef: { path: string; oid: string }) => Promise<Buffer>>()
const mockGetInstance = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: (...args: unknown[]) => mockGetInstance(...args),
    },
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInstance.mockReturnValue({
    getFilesPath: mockGetFilesPath,
    getBufferContent: mockGetBufferContent,
  })
  mockBuildIgnoreHelper.mockResolvedValue({
    globalIgnore: {
      ignores: () => false,
    } as unknown as Ignore,
  } as unknown as IgnoreHelper)
})

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
})
