'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import sgd from '../../src/main'
import type { Config } from '../../src/types/config'
import type { HandlerResult } from '../../src/types/handlerResult'
import {
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../../src/types/handlerResult'

jest.mock('../../src/utils/LoggingService')

const mockPreBuildTreeIndex = jest.fn()
jest.mock('../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: jest.fn(() => ({
      preBuildTreeIndex: mockPreBuildTreeIndex,
    })),
    closeAll: jest.fn(),
  },
}))

const mockComputeTreeIndexScope = jest.fn()
jest.mock('../../src/utils/treeIndexScope', () => ({
  computeTreeIndexScope: (...args: unknown[]) =>
    mockComputeTreeIndexScope(...args),
}))

const mockValidateConfig = jest.fn()
jest.mock('../../src/utils/configValidator', () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const actualModule: any = jest.requireActual(
    '../../src/utils/configValidator'
  )
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        ...actualModule,
        validateConfig: mockValidateConfig,
      }
    }),
  }
})

const mockGetLines = jest.fn()
jest.mock('../../src/utils/repoGitDiff', () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const actualModule: any = jest.requireActual('../../src/utils/repoGitDiff')
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        ...actualModule,
        getLines: mockGetLines,
      }
    }),
  }
})

const mockProcess = jest.fn<(lines: string[]) => Promise<HandlerResult>>()
jest.mock('../../src/service/diffLineInterpreter', () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const actualModule: any = jest.requireActual(
    '../../src/service/diffLineInterpreter'
  )
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        ...actualModule,
        process: mockProcess,
      }
    }),
  }
})

const mockCollectAll = jest.fn<() => Promise<HandlerResult>>()
const mockExecuteRemaining = jest.fn()
jest.mock('../../src/post-processor/postProcessorManager', () => {
  return {
    getPostProcessors: jest.fn().mockImplementation(() => {
      return {
        collectAll: mockCollectAll,
        executeRemaining: mockExecuteRemaining,
      }
    }),
  }
})

const mockExecute = jest.fn()
jest.mock('../../src/service/ioExecutor', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        execute: mockExecute,
      }
    }),
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  mockProcess.mockResolvedValue(emptyResult())
  mockCollectAll.mockResolvedValue(emptyResult())
  mockGetLines.mockResolvedValue([] as never)
  mockComputeTreeIndexScope.mockReturnValue(new Set())
})

describe('external library inclusion', () => {
  describe('when configuration is not valid', () => {
    beforeEach(() => {
      // Arrange
      mockValidateConfig.mockImplementationOnce(() =>
        Promise.reject(new Error('test'))
      )
    })

    it('it should throw', async () => {
      // Arrange
      expect.assertions(1)

      // Act
      try {
        await sgd({} as Config)
      } catch (error) {
        // Assert
        expect((error as Error).message).toEqual('test')
      }
    })
  })

  describe('when there are no changes', () => {
    beforeEach(() => {
      // Arrange
      mockGetLines.mockImplementationOnce(() => Promise.resolve([]))
    })
    it('it should not process lines', async () => {
      // Act
      await sgd({} as Config)

      // Assert
      expect(mockProcess).toHaveBeenCalledWith([])
    })
  })

  describe('when there are changes', () => {
    beforeEach(() => {
      // Arrange
      mockGetLines.mockImplementationOnce(() => Promise.resolve(['line']))
    })
    it('it should process those lines', async () => {
      // Act
      await sgd({} as Config)

      // Assert
      expect(mockProcess).toHaveBeenCalledWith(['line'])
    })
  })

  describe('orchestration flow', () => {
    it('Given valid config, When sgd runs, Then returns work with diffs and empty warnings', async () => {
      // Act
      const result = await sgd({} as Config)

      // Assert
      expect(result.diffs).toBeDefined()
      expect(result.diffs.package).toBeInstanceOf(Map)
      expect(result.diffs.destructiveChanges).toBeInstanceOf(Map)
      expect(result.warnings).toEqual([])
    })

    it('Given handler produces copies, When sgd runs, Then IOExecutor receives combined copies', async () => {
      // Arrange
      const handlerCopy = {
        kind: CopyOperationKind.GitCopy as const,
        path: 'test/path',
        revision: 'HEAD',
      }
      mockProcess.mockResolvedValueOnce({
        manifests: [],
        copies: [handlerCopy],
        warnings: [],
      })

      // Act
      await sgd({} as Config)

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ path: 'test/path' })])
      )
    })

    it('Given post-processor produces results, When sgd runs, Then results are merged into work', async () => {
      // Arrange
      mockCollectAll.mockResolvedValueOnce({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'TestClass',
          },
        ],
        copies: [],
        warnings: [],
      })

      // Act
      const result = await sgd({} as Config)

      // Assert
      expect(result.diffs.package.has('ApexClass')).toBe(true)
      expect(mockExecuteRemaining).toHaveBeenCalledTimes(1)
    })

    it('Given handler and post-processor produce warnings, When sgd runs, Then warnings are collected in work', async () => {
      // Arrange
      const handlerWarning = new Error('handler warning')
      const postWarning = new Error('post-processor warning')
      mockProcess.mockResolvedValueOnce({
        manifests: [],
        copies: [],
        warnings: [handlerWarning],
      })
      mockCollectAll.mockResolvedValueOnce({
        manifests: [],
        copies: [],
        warnings: [postWarning],
      })

      // Act
      const result = await sgd({} as Config)

      // Assert
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings).toContain(handlerWarning)
      expect(result.warnings).toContain(postWarning)
    })
  })

  describe('tree index scoping', () => {
    it('Given generateDelta is false, When sgd runs, Then preBuildTreeIndex is not called', async () => {
      // Act
      await sgd({ generateDelta: false } as Config)

      // Assert
      expect(mockPreBuildTreeIndex).not.toHaveBeenCalled()
    })

    it('Given generateDelta is true with include set, When sgd runs, Then preBuildTreeIndex is called with config.source', async () => {
      // Arrange
      const sut = {
        generateDelta: true,
        include: 'include.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as Config

      // Act
      await sgd(sut)

      // Assert
      expect(mockPreBuildTreeIndex).toHaveBeenCalledWith('HEAD', ['force-app'])
      expect(mockPreBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', [
        'force-app',
      ])
      expect(mockComputeTreeIndexScope).not.toHaveBeenCalled()
    })

    it('Given generateDelta is true with includeDestructive set, When sgd runs, Then preBuildTreeIndex is called with config.source', async () => {
      // Arrange
      const sut = {
        generateDelta: true,
        includeDestructive: 'destructive.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['src'],
      } as Config

      // Act
      await sgd(sut)

      // Assert
      expect(mockPreBuildTreeIndex).toHaveBeenCalledWith('HEAD', ['src'])
      expect(mockPreBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', ['src'])
    })

    it('Given generateDelta is true with computed scope paths, When sgd runs, Then preBuildTreeIndex is called with scope paths', async () => {
      // Arrange
      mockComputeTreeIndexScope.mockReturnValueOnce(
        new Set(['force-app/main/default/classes'])
      )
      const sut = {
        generateDelta: true,
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as Config

      // Act
      await sgd(sut)

      // Assert
      expect(mockComputeTreeIndexScope).toHaveBeenCalled()
      expect(mockPreBuildTreeIndex).toHaveBeenCalledWith('HEAD', [
        'force-app/main/default/classes',
      ])
      expect(mockPreBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', [
        'force-app/main/default/classes',
      ])
    })

    it('Given generateDelta is true with empty scope paths, When sgd runs, Then preBuildTreeIndex is not called', async () => {
      // Arrange
      mockComputeTreeIndexScope.mockReturnValueOnce(new Set())
      const sut = {
        generateDelta: true,
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as Config

      // Act
      await sgd(sut)

      // Assert
      expect(mockComputeTreeIndexScope).toHaveBeenCalled()
      expect(mockPreBuildTreeIndex).not.toHaveBeenCalled()
    })
  })
})
