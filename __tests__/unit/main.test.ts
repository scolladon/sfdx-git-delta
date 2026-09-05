'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import IOExecutor from '../../src/adapter/ioExecutor'
import { TreeIndex } from '../../src/adapter/treeIndex'
import { EMPTY_TREE_READER } from '../../src/adapter/treeReader'
import sgd from '../../src/main'
import DiffLineInterpreter from '../../src/service/diffLineInterpreter'
import type { ConfigInput } from '../../src/types/config'
import type { HandlerResult } from '../../src/types/handlerResult'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../../src/types/handlerResult'
import type { RunContext } from '../../src/types/runContext'
import type ChangeSet from '../../src/utils/changeSet'
import { Logger } from '../../src/utils/LoggingService'
import { makeHandlerResult } from '../__utils__/handlerResultView'

const {
  mockBuildTreeIndex,
  mockComputeTreeIndexScope,
  mockValidateConfig,
  mockGetLines,
  mockGetRenamePairs,
  mockGetUnmatchedSourceScopes,
  mockGetHeldAdditionProbeFailure,
  mockProcess,
  mockCollectAll,
  mockExecuteRemaining,
  mockExecute,
  mockCloseAll,
  mockGetMessage,
} = vi.hoisted(() => ({
  mockBuildTreeIndex: vi.fn(),
  mockComputeTreeIndexScope: vi.fn(),
  mockValidateConfig: vi.fn(),
  mockGetLines: vi.fn(),
  mockGetRenamePairs:
    vi.fn<() => Array<{ fromPath: string; toPath: string }>>(),
  mockGetUnmatchedSourceScopes: vi.fn<() => readonly string[]>(),
  mockGetHeldAdditionProbeFailure:
    vi.fn<() => { candidateCount: number } | undefined>(),
  mockProcess: vi.fn<(lines: string[]) => Promise<HandlerResult>>(),
  mockCollectAll: vi.fn<(changes: ChangeSet) => Promise<HandlerResult>>(),
  mockExecuteRemaining: vi.fn(),
  mockExecute: vi.fn(),
  mockCloseAll: vi.fn(),
  mockGetMessage: vi.fn(
    (key: string, tokens?: string[]) => `${key}:${tokens?.join(',') ?? ''}`
  ),
}))

vi.mock('../../src/utils/LoggingService')

vi.mock('../../src/utils/MessageService', () => ({
  MessageService: vi.fn().mockImplementation(function () {
    return { getMessage: mockGetMessage }
  }),
}))

vi.mock('../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: vi.fn(() => ({
      buildTreeIndex: mockBuildTreeIndex,
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
        getUnmatchedSourceScopes: mockGetUnmatchedSourceScopes,
        getHeldAdditionProbeFailure: mockGetHeldAdditionProbeFailure,
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

// getLines is now an async generator. Tests express the upstream output
// as an array; this helper turns it into an iterable the production code
// can consume via `for await`.
const asAsyncIterable = (lines: string[]): AsyncIterable<string> => ({
  async *[Symbol.asyncIterator]() {
    for (const line of lines) yield line
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateConfig.mockResolvedValue([])
  mockProcess.mockResolvedValue(emptyResult())
  mockCollectAll.mockResolvedValue(emptyResult())
  mockExecuteRemaining.mockResolvedValue([])
  mockGetLines.mockReturnValue(asAsyncIterable([]) as never)
  mockGetRenamePairs.mockReturnValue([])
  mockGetUnmatchedSourceScopes.mockReturnValue([])
  mockGetHeldAdditionProbeFailure.mockReturnValue(undefined)
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
      await expect(sgd({ source: [] } as ConfigInput)).rejects.toThrow('test')
    })
  })

  describe('when there are no changes', () => {
    beforeEach(() => {
      // Arrange
      mockGetLines.mockReturnValueOnce(asAsyncIterable([]))
    })
    it('it should not process lines', async () => {
      // Act
      await sgd({ generateDelta: false, source: [] } as ConfigInput)

      // Assert — with no include file the diff is materialised for the
      // scope read; the suite's default empty scope builds no index, so
      // only the single process() call is observable here.
      expect(mockProcess).toHaveBeenCalledTimes(1)
    })
  })

  describe('when there are changes', () => {
    beforeEach(() => {
      // Arrange
      mockGetLines.mockReturnValueOnce(asAsyncIterable(['line']))
    })
    it('it should process those lines', async () => {
      // Act
      await sgd({ generateDelta: false, source: [] } as ConfigInput)

      // Assert
      expect(mockProcess).toHaveBeenCalledTimes(1)
    })
  })

  describe('orchestration flow', () => {
    it('Given valid config, When sgd runs, Then returns work with an initialised ChangeSet and empty warnings', async () => {
      // Act
      const result = await sgd({ source: [] } as ConfigInput)

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
      mockProcess.mockResolvedValueOnce(
        makeHandlerResult({ copies: [handlerCopy] })
      )

      // Act
      await sgd({ source: [] } as ConfigInput)

      // Assert
      expect(mockExecute).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ path: 'test/path' })])
      )
    })

    it('Given post-processor produces results, When sgd runs, Then results are merged into work', async () => {
      // Arrange
      mockCollectAll.mockResolvedValueOnce(
        makeHandlerResult({
          manifests: [
            {
              target: ManifestTarget.Package,
              type: 'ApexClass',
              member: 'TestClass',
              changeKind: ChangeKind.Add,
            },
          ],
        })
      )

      // Act
      const result = await sgd({ source: [] } as ConfigInput)

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
      mockProcess.mockResolvedValueOnce(
        makeHandlerResult({
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
        })
      )

      // Act
      const result = await sgd({ source: [] } as ConfigInput)

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
      mockProcess.mockResolvedValueOnce(
        makeHandlerResult({ warnings: [handlerWarning] })
      )
      mockCollectAll.mockResolvedValueOnce(
        makeHandlerResult({ warnings: [postWarning] })
      )

      // Act
      const result = await sgd({ source: [] } as ConfigInput)

      // Assert
      expect(result.warnings).toHaveLength(2)
      expect(result.warnings).toContain(handlerWarning)
      expect(result.warnings).toContain(postWarning)
    })

    it('Given collectors contribute elements, When sgd runs, Then collectAll sees the handler pass only', async () => {
      // Arrange — collectors introspect the package view to decide what to
      // emit, so they must see the handler pass before their own output is
      // folded in. Feeding them the combined set would let one collector's
      // output change another's decision.
      const handlerElement = {
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'FromHandlerPass',
        changeKind: ChangeKind.Add,
      }
      const collectorElement = {
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'FromCollector',
        changeKind: ChangeKind.Add,
      }
      mockProcess.mockResolvedValueOnce(
        makeHandlerResult({ manifests: [handlerElement] })
      )
      mockCollectAll.mockResolvedValueOnce(
        makeHandlerResult({ manifests: [collectorElement] })
      )

      // Act
      const result = await sgd({} as ConfigInput)

      // Assert — the view handed to the collectors carries the handler
      // element and not the collector's own, while the final manifest carries
      // both.
      const viewPassedToCollectors = mockCollectAll.mock.calls[0]![0]
      const packagedForCollectors = viewPassedToCollectors
        .forPackageManifest()
        .get('ApexClass')
      expect(packagedForCollectors).toEqual(new Set(['FromHandlerPass']))

      expect(result.changes.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['FromHandlerPass', 'FromCollector'])
      )
    })

    it('Given every producer emits a warning, When sgd runs, Then all are surfaced in producer order', async () => {
      // Arrange — config validation runs first, then the handler pass and its
      // collectors, then the remaining processors. That sequence is printed
      // verbatim to the user, so it is asserted as a sequence, not a set.
      const configWarning = new Error('config warning')
      const handlerWarning = new Error('handler warning')
      const collectorWarning = new Error('collector warning')
      const processorWarning = new Error('processor warning')
      mockValidateConfig.mockResolvedValueOnce([configWarning])
      mockProcess.mockResolvedValueOnce(
        makeHandlerResult({ warnings: [handlerWarning] })
      )
      mockCollectAll.mockResolvedValueOnce(
        makeHandlerResult({ warnings: [collectorWarning] })
      )
      mockExecuteRemaining.mockResolvedValueOnce([processorWarning])

      // Act
      const result = await sgd({} as ConfigInput)

      // Assert
      expect(result.warnings).toEqual([
        configWarning,
        handlerWarning,
        collectorWarning,
        processorWarning,
      ])
    })
  })

  describe('tree index scoping', () => {
    it('Given sgd runs to completion, When the finally block executes, Then GitAdapter.closeAll is invoked to dispose the tsgit repository', async () => {
      // Act
      await sgd({ source: [] } as ConfigInput)

      // Assert — the mutation that empties the finally block would skip this.
      expect(mockCloseAll).toHaveBeenCalledOnce()
    })

    it('Given include set, When sgd runs, Then buildTreeIndex is called with config.source', async () => {
      // Arrange
      const sut = {
        include: 'include.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD', ['force-app'])
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', ['force-app'])
      expect(mockComputeTreeIndexScope).not.toHaveBeenCalled()
    })

    it('Given a --source-dir with a trailing slash, When sgd runs, Then buildTreeIndex receives the canonical path', async () => {
      // Arrange
      const sut = {
        include: 'include.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app/'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD', ['force-app'])
    })

    it('Given includeDestructive set, When sgd runs, Then buildTreeIndex is called with config.source', async () => {
      // Arrange
      const sut = {
        includeDestructive: 'destructive.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['src'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD', ['src'])
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', ['src'])
    })

    it('Given computed scope paths, When sgd runs, Then buildTreeIndex is called with scope paths', async () => {
      // Arrange
      mockComputeTreeIndexScope.mockReturnValueOnce(
        new Set(['force-app/main/default/classes'])
      )
      const sut = {
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockComputeTreeIndexScope).toHaveBeenCalled()
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD', [
        'force-app/main/default/classes',
      ])
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', [
        'force-app/main/default/classes',
      ])
    })

    it('Given empty scope paths, When sgd runs, Then buildTreeIndex is not called', async () => {
      // Arrange
      mockComputeTreeIndexScope.mockReturnValueOnce(new Set())
      const sut = {
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockComputeTreeIndexScope).toHaveBeenCalled()
      expect(mockBuildTreeIndex).not.toHaveBeenCalled()
    })

    it('Given empty scope paths, When sgd runs, Then IOExecutor falls back to the shared EMPTY_TREE_READER as ctx.trees', async () => {
      // Arrange — pins the empty-scope fallback only (buildRunTreeReader's
      // own short-circuit). It cannot guard a built reader actually
      // reaching consumers: see the non-empty-scope case below for that.
      mockComputeTreeIndexScope.mockReturnValueOnce(new Set())
      const sut = {
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      const ctxArg = vi.mocked(IOExecutor).mock.calls[0]?.[0] as
        | RunContext
        | undefined
      expect(ctxArg?.trees).toBe(EMPTY_TREE_READER)
    })

    it('Given a non-empty scope, When sgd runs, Then IOExecutor and DiffLineInterpreter both receive the built tree reader as ctx.trees', async () => {
      // Arrange — the previous version of this pin expected EMPTY_TREE_READER
      // itself, which is also what the regression it claims to guard
      // (threading `trees: EMPTY_TREE_READER` unconditionally, ignoring
      // whatever buildRunTreeReader actually returned) would produce: the
      // assertion cannot fail under that regression. A non-empty scope
      // forces buildTreeIndex to run and its result to reach every
      // consumer for the pin to mean anything; pathExists answering true
      // for a path only the built index holds proves it is that reader,
      // not a fallback.
      const scopedPath = 'force-app/main/default/classes/Foo.cls'
      const toIndex = new TreeIndex()
      toIndex.add(scopedPath)
      mockComputeTreeIndexScope.mockReturnValueOnce(new Set([scopedPath]))
      mockBuildTreeIndex.mockResolvedValueOnce(toIndex)
      const sut = {
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      const ioExecutorCtx = vi.mocked(IOExecutor).mock.calls[0]?.[0] as
        | RunContext
        | undefined
      const interpreterCtx = vi.mocked(DiffLineInterpreter).mock
        .calls[0]?.[0] as RunContext | undefined
      expect(ioExecutorCtx?.trees.pathExists('HEAD', scopedPath)).toBe(true)
      expect(interpreterCtx?.trees).toBe(ioExecutorCtx?.trees)
    })

    it('Given the diff stream emits lines, When sgd runs, Then the materialize-once branch buffers them for both the scope read and the handler pass (main L46)', async () => {
      // Arrange — the materialize branch (`needsScopeFromDiff` true)
      // pushes each yielded line into a string[] so both
      // computeTreeIndexScope and lineProcessor.process can iterate
      // the same data. Without an actual line yielded the
      // materialized.push branch never fires, leaving L46 uncovered.
      mockGetLines.mockReturnValueOnce(
        asAsyncIterable([
          'A\tforce-app/main/default/classes/Foo.cls',
          'M\tforce-app/main/default/classes/Bar.cls',
        ])
      )
      mockComputeTreeIndexScope.mockReturnValueOnce(
        new Set(['force-app/main/default/classes'])
      )
      const sut = {
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert — process gets the materialized array; treeIndexScope
      // also saw it (via the same buffered array reference).
      expect(mockProcess).toHaveBeenCalledTimes(1)
      expect(mockComputeTreeIndexScope).toHaveBeenCalled()
      const passedLines = mockProcess.mock.calls[0]?.[0]
      expect(Array.isArray(passedLines)).toBe(true)
      expect(passedLines).toHaveLength(2)
    })

    it('Given no include file and generateDelta false, When sgd runs, Then buildTreeIndex is called for config.to and config.from with the computed scope', async () => {
      // Arrange
      mockComputeTreeIndexScope.mockReturnValueOnce(
        new Set(['force-app/main/default/lwc/foo'])
      )
      const sut = {
        generateDelta: false,
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD', [
        'force-app/main/default/lwc/foo',
      ])
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', [
        'force-app/main/default/lwc/foo',
      ])
    })

    it('Given no include file and generateDelta false, When sgd runs, Then process receives the materialised line array that the scope read also saw', async () => {
      // Arrange
      mockGetLines.mockReturnValueOnce(
        asAsyncIterable([
          'D\tforce-app/main/default/lwc/foo/foo.html',
          'M\tforce-app/main/default/classes/Bar.cls',
        ])
      )
      const sut = {
        generateDelta: false,
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      const passedLines = mockProcess.mock.calls[0]?.[0]
      expect(Array.isArray(passedLines)).toBe(true)
      expect(passedLines).toHaveLength(2)
      expect(mockComputeTreeIndexScope).toHaveBeenCalledWith(
        passedLines,
        expect.anything()
      )
    })

    it('Given an include file and generateDelta false, When sgd runs, Then buildTreeIndex is called with config.source and process receives the streamed iterable', async () => {
      // Arrange
      const sut = {
        generateDelta: false,
        include: 'include.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD', ['force-app'])
      expect(mockBuildTreeIndex).toHaveBeenCalledWith('HEAD~1', ['force-app'])
      expect(mockComputeTreeIndexScope).not.toHaveBeenCalled()
      expect(mockProcess.mock.calls[0]?.[0]).toBe(
        mockGetLines.mock.results[0]?.value
      )
    })

    it('Given an empty computed scope and generateDelta false, When sgd runs, Then buildTreeIndex is not called', async () => {
      // Arrange
      const sut = {
        generateDelta: false,
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      } as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).not.toHaveBeenCalled()
    })

    it('Given the same config with generateDelta false and true, When sgd runs once each, Then buildTreeIndex receives identical arguments in both runs', async () => {
      // Arrange
      const baseConfig = {
        to: 'HEAD',
        from: 'HEAD~1',
        source: ['force-app'],
      }
      mockComputeTreeIndexScope.mockReturnValue(
        new Set(['force-app/main/default/lwc/foo'])
      )

      // Act
      await sgd({ ...baseConfig, generateDelta: false } as ConfigInput)
      const callsWhenFalse = mockBuildTreeIndex.mock.calls
      mockBuildTreeIndex.mockClear()
      await sgd({ ...baseConfig, generateDelta: true } as ConfigInput)
      const callsWhenTrue = mockBuildTreeIndex.mock.calls

      // Assert
      expect(callsWhenFalse).toEqual(callsWhenTrue)
    })
  })

  describe('source scope warning', () => {
    it('Given RepoGitDiff reports every source scope matched nothing, When sgd runs, Then a warning naming the scopes is pushed to work.warnings', async () => {
      // Arrange
      mockGetUnmatchedSourceScopes.mockReturnValueOnce(['force-app'])
      const sut = {
        source: ['force-app'],
        from: 'HEAD~1',
        to: 'HEAD',
      } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toBe(
        'warning.SourceDirMatchedNothing:force-app,HEAD~1,HEAD'
      )
    })

    it('Given RepoGitDiff reports two unmatched source scopes, When sgd runs, Then the warning message renders both scopes joined by a comma', async () => {
      // Arrange
      mockGetUnmatchedSourceScopes.mockReturnValueOnce(['force-app', 'other'])
      const sut = {
        source: ['force-app', 'other'],
        from: 'HEAD~1',
        to: 'HEAD',
      } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert — both scopes must survive rendering; a join('|') or an
      // unmatchedScopes[0]! mutant would silently drop 'other'.
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toBe(
        'warning.SourceDirMatchedNothing:force-app, other,HEAD~1,HEAD'
      )
    })

    it('Given RepoGitDiff reports an unmatched scope containing a control character, When sgd runs, Then the warning message carries the escaped form and never the raw character', async () => {
      // Arrange
      const scopeWithNewline = 'force-app\nPASSED'
      mockGetUnmatchedSourceScopes.mockReturnValueOnce([scopeWithNewline])
      const sut = {
        source: [scopeWithNewline],
        from: 'HEAD~1',
        to: 'HEAD',
      } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert — proves sanitizeForMessage is still applied at this
      // warning site: a newline is a legal git path character that would
      // otherwise forge an extra log line.
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toBe(
        'warning.SourceDirMatchedNothing:force-app\\u{a}PASSED,HEAD~1,HEAD'
      )
      expect(result.warnings[0]?.message).not.toContain(scopeWithNewline)
    })

    it('Given RepoGitDiff reports two unmatched scopes where the first exceeds the sanitizer length cap, When sgd runs, Then the second scope still appears in the message', async () => {
      // Arrange — the cap must apply per scope before joining; capping
      // the joined aggregate instead would let one long scope name elide
      // every scope listed after it.
      const longScope = 'a'.repeat(250)
      mockGetUnmatchedSourceScopes.mockReturnValueOnce([longScope, 'force-app'])
      const sut = {
        source: [longScope, 'force-app'],
        from: 'HEAD~1',
        to: 'HEAD',
      } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toBe(
        `warning.SourceDirMatchedNothing:${'a'.repeat(200)}…, force-app,HEAD~1,HEAD`
      )
    })

    it('Given RepoGitDiff reports unmatched scopes but a post-processor still produced changes, When sgd runs, Then no warning is pushed', async () => {
      // Arrange — mirrors --include-file sourcing members via getFilesPath
      // independent of the diff: the run is not silently empty, so naming
      // the scope as unmatched would be misleading.
      mockGetUnmatchedSourceScopes.mockReturnValueOnce(['force-app'])
      mockCollectAll.mockResolvedValueOnce(
        makeHandlerResult({
          manifests: [
            {
              target: ManifestTarget.Package,
              type: 'ApexClass',
              member: 'TestClass',
              changeKind: ChangeKind.Add,
            },
          ],
        })
      )
      const sut = {
        source: ['force-app'],
        from: 'HEAD~1',
        to: 'HEAD',
      } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toEqual([])
    })
  })

  describe('ignored move check warning', () => {
    it('Given RepoGitDiff could not list the target revision, When sgd runs, Then a warning naming the revision and the component count is pushed to work.warnings', async () => {
      // Arrange
      mockGetHeldAdditionProbeFailure.mockReturnValueOnce({ candidateCount: 2 })
      const sut = { from: 'HEAD~1', to: 'HEAD' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toBe(
        'warning.IgnoredMoveCheckSkipped:HEAD,2'
      )
    })

    it('Given RepoGitDiff listed the target revision, When sgd runs, Then no warning is pushed', async () => {
      // Arrange
      const sut = { from: 'HEAD~1', to: 'HEAD' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toEqual([])
    })

    it('Given the target revision contains a control character, When sgd runs, Then the warning carries the escaped form and never the raw character', async () => {
      // Arrange
      mockGetHeldAdditionProbeFailure.mockReturnValueOnce({ candidateCount: 1 })
      const sut = { from: 'HEAD~1', to: 'HEAD\x07' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings[0]?.message).not.toContain('\x07')
    })
  })

  describe('tree index unavailable warning', () => {
    beforeEach(() => {
      // Arrange — a non-empty scope so buildRunTreeReader actually attempts
      // to walk both revisions instead of short-circuiting to the empty
      // reader.
      mockComputeTreeIndexScope.mockReturnValue(
        new Set(['force-app/main/default/lwc/foo'])
      )
    })

    it('Given buildTreeIndex could not build an index for the to revision, When sgd runs, Then a warning naming the to revision is pushed to work.warnings', async () => {
      // Arrange
      mockBuildTreeIndex
        .mockResolvedValueOnce(undefined) // to
        .mockResolvedValueOnce(new TreeIndex()) // from
      const sut = { from: 'HEAD~1', to: 'HEAD' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toBe(
        'warning.TreeIndexUnavailable:HEAD'
      )
    })

    it('Given buildTreeIndex could not build an index for the from revision but the to revision indexed, When sgd runs, Then no warning is pushed', async () => {
      // Arrange — the from revision only feeds deep-path member-name
      // resolution, not container liveness, so it is not warn-worthy here.
      mockBuildTreeIndex
        .mockResolvedValueOnce(new TreeIndex()) // to
        .mockResolvedValueOnce(undefined) // from
      const sut = { from: 'HEAD~1', to: 'HEAD' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toEqual([])
    })

    it('Given both revisions index successfully, When sgd runs, Then no warning is pushed', async () => {
      // Arrange
      mockBuildTreeIndex
        .mockResolvedValueOnce(new TreeIndex()) // to
        .mockResolvedValueOnce(new TreeIndex()) // from
      const sut = { from: 'HEAD~1', to: 'HEAD' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toEqual([])
    })

    it('Given the scope is empty, When sgd runs, Then no tree index warning is pushed and buildTreeIndex is never called', async () => {
      // Arrange — nothing was attempted, so nothing degraded.
      mockComputeTreeIndexScope.mockReturnValue(new Set())
      const sut = { from: 'HEAD~1', to: 'HEAD' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings).toEqual([])
      expect(mockBuildTreeIndex).not.toHaveBeenCalled()
    })

    it('Given the to revision contains a control character and its walk failed, When sgd runs, Then the warning carries the escaped form and never the raw character', async () => {
      // Arrange
      mockBuildTreeIndex
        .mockResolvedValueOnce(undefined) // to
        .mockResolvedValueOnce(new TreeIndex()) // from
      const sut = { from: 'HEAD~1', to: 'HEAD\x07' } as ConfigInput

      // Act
      const result = await sgd(sut)

      // Assert
      expect(result.warnings[0]?.message).not.toContain('\x07')
    })
  })

  describe('source scope warning (continued)', () => {
    it('Given source is nullish, When sgd runs, Then it is treated as an empty source list', async () => {
      // Arrange
      const sut = { source: undefined } as unknown as ConfigInput

      // Act & Assert
      await expect(sgd(sut)).resolves.not.toThrow()
    })

    it('Given source is nullish and generateDelta is true, When sgd runs, Then buildTreeIndex is not called (parseSourceDirs received an empty array, not a non-empty fallback)', async () => {
      // Arrange — main L30's `configInput.source ?? []` fallback feeds
      // parseSourceDirs. A non-empty fallback array would canonicalise to a
      // non-empty config.source, which would make scopePaths.length > 0
      // below and trigger buildTreeIndex — the only way this branch is
      // observable from outside.
      const sut = {
        generateDelta: true,
        include: 'include.txt',
        to: 'HEAD',
        from: 'HEAD~1',
        source: undefined,
      } as unknown as ConfigInput

      // Act
      await sgd(sut)

      // Assert
      expect(mockBuildTreeIndex).not.toHaveBeenCalled()
    })
  })

  describe('diagnostic logging (main L26, L28, L158, L160)', () => {
    // Content is intentionally not asserted here (see the StringLiteral
    // Stryker disables on these same call sites — log content is
    // observability only). What is asserted is that the call sites
    // themselves fire: a CallExpression mutant removing any one of the
    // four Logger.trace/debug statements drops the relevant count.
    it('Given sgd completes successfully, When it runs, Then it emits exactly one entry trace and one exit trace', async () => {
      // Act
      await sgd({ source: [] } as ConfigInput)

      // Assert — main.ts is the only reachable call site that hands
      // Logger.trace a plain string; every other trace call in this run
      // (the @log decorator wrapping the unmocked RenameResolver.resolve)
      // hands it a lazy closure instead, so filtering by argument shape —
      // not content — isolates main.ts's own two trace sites.
      const ownTraceCalls = vi
        .mocked(Logger.trace)
        .mock.calls.filter(([message]) => typeof message === 'string')
      expect(ownTraceCalls).toHaveLength(2)
    })

    it('Given sgd completes successfully, When it runs, Then it emits exactly one debug log for the received arguments and one for the returned work', async () => {
      // Act
      await sgd({ source: [] } as ConfigInput)

      // Assert — main.ts is the only reachable Logger.debug call site in
      // this run (ConfigValidator/GitAdapter/IOExecutor are mocked out).
      expect(Logger.debug).toHaveBeenCalledTimes(2)
    })
  })
})
