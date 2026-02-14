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
})
