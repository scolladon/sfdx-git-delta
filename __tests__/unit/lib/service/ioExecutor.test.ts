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

const mockBuildIgnoreHelper = jest.mocked(buildIgnoreHelper)

const mockGetFilesFrom = jest.fn()
const mockGetInstance = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: (...args: unknown[]) => mockGetInstance(...args),
    },
  }
})

beforeEach(() => {
  jest.resetAllMocks()
  mockGetInstance.mockReturnValue({
    getFilesFrom: mockGetFilesFrom,
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
      mockGetFilesFrom.mockImplementation(async function* () {
        yield await {
          path: 'classes/MyClass.cls',
          content: Buffer.from('content'),
        }
      })
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
      expect(mockGetFilesFrom).toHaveBeenCalledWith('classes/MyClass.cls')
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
      mockGetFilesFrom.mockImplementation(async function* () {
        yield await {
          path: 'classes/MyClass.cls',
          content: Buffer.from('class content'),
        }
      })

      // Act
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/MyClass.cls',
          revision: 'abc123',
        },
      ])

      // Assert
      expect(mockGetFilesFrom).toHaveBeenCalledWith('classes/MyClass.cls')
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
      mockGetFilesFrom.mockImplementation(async function* () {
        yield await {
          path: 'classes/MyClass.cls',
          content: Buffer.from('content'),
        }
      })
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
      expect(mockGetFilesFrom).toHaveBeenCalledTimes(1)
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
      expect(mockGetFilesFrom).not.toHaveBeenCalled()
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
      mockGetFilesFrom.mockImplementation(async function* () {
        throw new Error('git error')
      })

      // Act & Assert (should not throw)
      await executor.execute([
        {
          kind: CopyOperationKind.GitCopy,
          path: 'classes/BadClass.cls',
          revision: 'abc123',
        },
      ])

      expect(mockGetFilesFrom).toHaveBeenCalled()
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
      mockGetFilesFrom.mockImplementation(async function* () {
        yield await {
          path: 'classes/MyClass.cls',
          content: Buffer.from('content'),
        }
      })

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
      mockGetFilesFrom.mockImplementation(async function* () {
        yield await {
          path: 'classes/MyClass.cls',
          content: Buffer.from('content'),
        }
      })

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

  describe('Given an empty copies array', () => {
    it('When executed, Then does nothing', async () => {
      // Arrange
      const work = getWork()
      const executor = new IOExecutor(work.config)

      // Act
      await executor.execute([])

      // Assert
      expect(mockGetFilesFrom).not.toHaveBeenCalled()
      expect(outputFile).not.toHaveBeenCalled()
    })
  })
})
