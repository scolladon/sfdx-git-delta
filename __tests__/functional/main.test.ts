'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import sgd from '../../src/main'
import type { Config } from '../../src/types/config'
import type { HandlerResult } from '../../src/types/handlerResult'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../../src/types/handlerResult'

const {
  mockPreBuildTreeIndex,
  mockComputeTreeIndexScope,
  mockValidateConfig,
  mockGetLines,
  mockGetRenamePairs,
  mockProcess,
  mockCollectAll,
  mockExecuteRemaining,
  mockExecute,
  mockCloseAll,
} = vi.hoisted(() => ({
  mockPreBuildTreeIndex: vi.fn(),
  mockComputeTreeIndexScope: vi.fn(),
  mockValidateConfig: vi.fn(),
  mockGetLines: vi.fn(),
  mockGetRenamePairs:
    vi.fn<() => Array<{ fromPath: string; toPath: string }>>(),
  mockProcess: vi.fn<(lines: string[]) => Promise<HandlerResult>>(),
  mockCollectAll: vi.fn<() => Promise<HandlerResult>>(),
  mockExecuteRemaining: vi.fn(),
  mockExecute: vi.fn(),
  mockCloseAll: vi.fn(),
}))

vi.mock('../../src/utils/LoggingService')

vi.mock('../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: vi.fn(() => ({
      preBuildTreeIndex: mockPreBuildTreeIndex,
    })),
    closeAll: mockCloseAll,
  },
}))

vi.mock('../../src/utils/treeIndexScope', () => ({
  computeTreeIndexScope: (...args: unknown[]) =>
    mockComputeTreeIndexScope(...args),
}))

vi.mock('../../src/utils/configValidator', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const actualModule: any = await vi.importActual(
    '../../src/utils/configValidator'
  )
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        ...actualModule,
        validateConfig: mockValidateConfig,
      }
    }),
  }
})

vi.mock('../../src/utils/repoGitDiff', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const actualModule: any = await vi.importActual('../../src/utils/repoGitDiff')
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        ...actualModule,
        getLines: mockGetLines,
        getRenamePairs: mockGetRenamePairs,
      }
    }),
  }
})

// RenameResolver instantiates TypeHandlerFactory and calls getTypeHandler for
// each rename path. Stub it so tests can control the (type, member)
// resolution without needing a real metadata registry lookup on synthetic
// fixture paths.
const mockGetTypeHandler = vi.hoisted(() => vi.fn())
vi.mock('../../src/service/typeHandlerFactory', () => ({
  default: vi.fn().mockImplementation(function () {
    return { getTypeHandler: mockGetTypeHandler }
  }),
}))

vi.mock('../../src/service/diffLineInterpreter', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const actualModule: any = await vi.importActual(
    '../../src/service/diffLineInterpreter'
  )
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        ...actualModule,
        process: mockProcess,
      }
    }),
  }
})

vi.mock('../../src/post-processor/postProcessorManager', () => {
  return {
    getPostProcessors: vi.fn().mockImplementation(function () {
      return {
        collectAll: mockCollectAll,
        executeRemaining: mockExecuteRemaining,
      }
    }),
  }
})

vi.mock('../../src/adapter/ioExecutor', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        execute: mockExecute,
      }
    }),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockProcess.mockResolvedValue(emptyResult())
  mockCollectAll.mockResolvedValue(emptyResult())
  mockGetLines.mockResolvedValue([] as never)
  mockGetRenamePairs.mockReturnValue([])
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
      // Act & Assert
      await expect(sgd({} as Config)).rejects.toThrow('test')
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
    it('Given valid config, When sgd runs, Then returns work with an initialised ChangeSet and empty warnings', async () => {
      // Act
      const result = await sgd({} as Config)

      // Assert
      expect(result.changes).toBeDefined()
      expect(result.changes.forPackageManifest()).toBeInstanceOf(Map)
      expect(result.changes.forDestructiveManifest()).toBeInstanceOf(Map)
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
            changeKind: ChangeKind.Add,
          },
        ],
        copies: [],
        warnings: [],
      })

      // Act
      const result = await sgd({} as Config)

      // Assert
      expect(result.changes.forPackageManifest().has('ApexClass')).toBe(true)
      expect(mockExecuteRemaining).toHaveBeenCalledTimes(1)
    })

    it('Given a rename pair, When sgd runs, Then RenameResolver records the pair on the final work.changes', async () => {
      // Arrange — emulate RepoGitDiff surfacing one rename pair after the
      // handler pipeline has added both synthetic A/D manifest elements.
      mockGetRenamePairs.mockReturnValueOnce([
        { fromPath: 'old/Foo.cls', toPath: 'new/Bar.cls' },
      ])
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Bar' }),
        })
      mockProcess.mockResolvedValueOnce({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'Bar',
            changeKind: ChangeKind.Add,
          },
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'ApexClass',
            member: 'Foo',
            changeKind: ChangeKind.Delete,
          },
        ],
        copies: [],
        warnings: [],
      })

      // Act
      const result = await sgd({} as Config)

      // Assert
      const rename = result.changes
        .byChangeKind()
        [ChangeKind.Rename].get('ApexClass')!
      expect([...rename.values()]).toEqual([{ from: 'Foo', to: 'Bar' }])
      // Add/Delete views exclude rename participants
      expect(
        result.changes.byChangeKind()[ChangeKind.Add].has('ApexClass')
      ).toBe(false)
      expect(
        result.changes.byChangeKind()[ChangeKind.Delete].has('ApexClass')
      ).toBe(false)
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

    it('Given generateDelta is false BUT source is populated, When sgd runs, Then preBuildTreeIndex is still not called (the generateDelta gate short-circuits before the scope computation)', async () => {
      // Arrange — distinguishes the generateDelta guard from the
      // scopePaths.length > 0 guard. Without the outer `if`, scopePaths
      // would take config.source and trigger preBuildTreeIndex.
      const sut = {
        generateDelta: false,
        source: ['force-app'],
        include: 'include.txt',
      } as Config

      // Act
      await sgd(sut)

      // Assert
      expect(mockPreBuildTreeIndex).not.toHaveBeenCalled()
    })

    it('Given sgd runs to completion, When the finally block executes, Then GitAdapter.closeAll is invoked to release batch cat-file processes', async () => {
      // Act
      await sgd({} as Config)

      // Assert — the mutation that empties the finally block would skip this.
      expect(mockCloseAll).toHaveBeenCalledOnce()
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
