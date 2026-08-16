'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TreeIndexes } from '../../../../src/adapter/gitTreeLister'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import type { Config } from '../../../../src/types/config'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  type HandlerResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import ChangeSet from '../../../../src/utils/changeSet'
import {
  buildIncludeHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { getConfig } from '../../../__utils__/testWork'

const { mockProcess, mockGetFilesPath, mockGetFirstCommitRef } = vi.hoisted(
  () => ({
    mockProcess: vi.fn<() => Promise<HandlerResult>>(),
    mockGetFilesPath: vi.fn(),
    mockGetFirstCommitRef: vi.fn<() => Promise<string>>(),
  })
)

vi.mock('../../../../src/service/diffLineInterpreter', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        process: mockProcess,
      }
    }),
  }
})

vi.mock('../../../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: vi.fn(() => ({
      getFirstCommitRef: mockGetFirstCommitRef,
    })),
  },
}))

vi.mock('../../../../src/utils/ignoreHelper')
const mockedBuildIncludeHelper = vi.mocked(buildIncludeHelper)

const mockKeep = vi.fn()
mockedBuildIncludeHelper.mockResolvedValue({
  keep: mockKeep,
} as unknown as IgnoreHelper)

// getFilesPath moved off GitAdapter onto the run-owned TreeIndexes holder —
// IncludeProcessor now takes it as its own collaborator (3rd ctor arg).
const mockAt = vi.fn((_revision: string) => ({
  getFilesPath: mockGetFilesPath,
}))
const treeIndexes = { at: mockAt } as unknown as TreeIndexes

describe('IncludeProcessor', () => {
  let config: Config
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  const includedManifest = {
    target: ManifestTarget.Package,
    type: 'ApexClass',
    member: 'Included',
    changeKind: ChangeKind.Add as ChangeKind.Add,
  }
  const includedCopy = {
    kind: CopyOperationKind.GitCopy as const,
    path: 'src/included.cls',
    revision: 'HEAD',
  }

  beforeEach(() => {
    config = getConfig()
    vi.clearAllMocks()
    mockProcess.mockResolvedValue({
      elements: [includedManifest],
      copies: [includedCopy],
      warnings: [],
    })
  })

  describe('process', () => {
    it('Given IncludeProcessor, When process is called, Then it is a no-op', async () => {
      // Arrange
      const sut = new IncludeProcessor(config, metadata, treeIndexes)

      // Act & Assert
      await expect(sut.process(new ChangeSet())).resolves.toEqual({
        warnings: [],
      })
    })
  })

  describe('when no include is configured', () => {
    it('does not process include', async () => {
      // Arrange
      const sut = new IncludeProcessor(config, metadata, treeIndexes)

      // Act
      const result = await sut.transformAndCollect(new ChangeSet())

      // Assert
      expect(elementsOf(result)).toEqual([])
      expect(mockedBuildIncludeHelper).not.toHaveBeenCalled()
    })
  })

  describe('when include is configured but the revision has no built tree index', () => {
    it('Then gathers no include lines (degrades to empty, not a throw)', async () => {
      // Arrange
      config.include = '.sgdinclude'
      const unbuiltTreeIndexes = {
        at: () => undefined,
      } as unknown as TreeIndexes
      const sut = new IncludeProcessor(config, metadata, unbuiltTreeIndexes)

      // Act
      const result = await sut.transformAndCollect(new ChangeSet())

      // Assert
      expect(result).toEqual(emptyResult())
      expect(mockProcess).not.toHaveBeenCalled()
    })
  })

  describe('when include is configured', () => {
    beforeAll(() => {
      mockGetFilesPath.mockImplementation(() => ['test'])
    })

    describe('when no file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(true)
      })
      it('Then returns an empty result', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(result).toEqual(emptyResult())
      })

      it('Then does not call DiffLineInterpreter.process (kills L70 ConditionalExpression false)', async () => {
        // Arrange — keep returns true for all lines, so includeLines map is empty
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        await sut.transformAndCollect(new ChangeSet())

        // Assert — emptyResult path taken, process never called
        expect(mockProcess).not.toHaveBeenCalled()
      })
    })

    describe('when file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(false)
      })
      it('Then aggregates the processed manifest and copy into the result', async () => {
        // Arrange — from/to must differ, or asserting mockAt was called
        // with config.to cannot tell that apart from config.from.
        config.include = '.sgdinclude'
        config.from = 'from-sha'
        config.to = 'to-sha'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(elementsOf(result).length).toBeGreaterThan(0)
        expect(elementsOf(result)).toContainEqual(includedManifest)
        expect(result.copies).toContainEqual(includedCopy)
        expect(mockAt).toHaveBeenCalledWith('to-sha')
        expect(mockGetFilesPath).toHaveBeenCalledWith(config.source)
      })
    })

    describe('when multiple files match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => ['test1', 'test2'])
        mockKeep.mockReturnValue(false)
      })
      it('Then aggregates at least one manifest entry per matched file', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)
        const baseline = elementsOf(
          await new IncludeProcessor(
            getConfig(),
            metadata,
            treeIndexes
          ).transformAndCollect(new ChangeSet())
        ).length

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(elementsOf(result).length).toBeGreaterThan(baseline)
        expect(elementsOf(result)).toContainEqual(includedManifest)
      })
    })

    describe('when only additions match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => ['test'])
        // Keep deletion lines, reject addition lines
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('D')) as typeof mockKeep)
      })
      it('Then collects include manifest entries (additions only)', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(elementsOf(result)).toContainEqual(includedManifest)
      })

      it('Then calls process with ADDITION lines only, not DELETION (kills L78 ConditionalExpression false)', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        await sut.transformAndCollect(new ChangeSet())

        // Assert — process called exactly once (for ADDITION), not twice
        expect(mockProcess).toHaveBeenCalledTimes(1)
      })
    })

    describe('when only deletions match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => ['test'])
        // Keep addition lines, reject deletion lines
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('A')) as typeof mockKeep)
      })
      it('Then collects include manifest entries (deletions only)', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(elementsOf(result)).toContainEqual(includedManifest)
      })

      it('Then calls process with DELETION lines only, not ADDITION (kills L86 ConditionalExpression true)', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        await sut.transformAndCollect(new ChangeSet())

        // Assert — process called exactly once (for DELETION), not twice
        expect(mockProcess).toHaveBeenCalledTimes(1)
      })
    })

    describe('when include helper is called with correct changedLine format (kills L55 StringLiteral "")', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => ['myFile.cls'])
        mockKeep.mockReturnValue(false)
      })

      it('Then keep is called with TAB-separated changeType+path line', async () => {
        // Arrange
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        await sut.transformAndCollect(new ChangeSet())

        // Assert — changedLine must be "A\tmyFile.cls" and "D\tmyFile.cls"
        // StringLiteral mutation "" would call keep("") instead
        expect(mockKeep).toHaveBeenCalledWith(
          expect.stringContaining('myFile.cls')
        )
        expect(mockKeep).toHaveBeenCalledWith(expect.stringContaining('\t'))
      })
    })

    describe('includeLines set initialization integrity (kills L57:15 true, L58:42 ArrayDeclaration)', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => ['file1.cls', 'file2.cls'])
        mockKeep.mockReturnValue(false) // all lines are included
      })

      it('When two files match, Then DiffLineInterpreter.process receives exactly 2 ADDITION lines (kills L57 true mutant)', async () => {
        // L57 mutant: if (true) → always reinitializes the array for each file,
        // so second file overwrites first → only 1 line per changeType.
        // Real: array initialized once, both lines pushed → 2 lines.
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        await sut.transformAndCollect(new ChangeSet())

        // ADDITION lines array should have exactly 2 entries (one per file)
        const additionCallArgs = mockProcess.mock.calls.find(call =>
          (call[0] as string[])[0]?.startsWith('A')
        )?.[0] as string[]
        expect(additionCallArgs).toHaveLength(2)
      })

      it('When one file matches, Then process is called with exactly [changeType+TAB+file] (kills L58 ArrayDeclaration ["Stryker was here"])', async () => {
        // L58 mutant: includeLines.set(changeType, ["Stryker was here"]) → stray entry
        // → process receives ["Stryker was here", "A\tfile.cls"] instead of ["A\tfile.cls"]
        mockGetFilesPath.mockImplementation(() => ['only.cls'])
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        await sut.transformAndCollect(new ChangeSet())

        // The ADDITION lines passed to process must contain only the real line, not "Stryker was here"
        const additionLines = mockProcess.mock.calls.find(call =>
          (call[0] as string[])[0]?.startsWith('A')
        )?.[0] as string[]
        expect(additionLines).toEqual(['A\tonly.cls'])
      })
    })

    describe('_collectIncludes emptyResult guard (kills L70:9 false, L70:34 BlockStatement {})', () => {
      it('When includeLines is empty, Then emptyResult is returned (L70 false mutant would call process unnecessarily)', async () => {
        // L70:9 false: if(false) → always proceeds past the emptyResult guard
        // → getFirstCommitRef() and DiffLineInterpreter.process() would be called even with no lines
        // L70:34 {}: the emptyResult() return is a no-op → same effect
        mockKeep.mockReturnValue(true) // keep all = nothing included
        config.include = '.sgdinclude'
        mockGetFilesPath.mockReturnValue(['test.cls'])
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        const result = await sut.transformAndCollect(new ChangeSet())

        // process must NOT be called since includeLines is empty
        expect(mockProcess).not.toHaveBeenCalled()
        expect(result).toEqual(emptyResult())
      })
    })

    describe('results array initialization (kills L76:38 ArrayDeclaration ["Stryker was here"])', () => {
      it('When ADDITION and DELETION both match, Then merged result contains exactly the items from process calls (no stray entries)', async () => {
        // L76 mutant: results = ["Stryker was here"] → mergeResults gets stray string as first result
        // mergeResults("Stryker was here", actual) → manifests = [undefined, ...actual.manifests]
        // The exact manifests array would differ (has an undefined entry).
        mockGetFilesPath.mockReturnValue(['file.cls'])
        mockKeep.mockReturnValue(false)
        config.include = '.sgdinclude'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        const result = await sut.transformAndCollect(new ChangeSet())

        // All manifests must be valid HandlerResult manifest objects (no undefined from stray entry)
        for (const m of elementsOf(result)) {
          expect(m).toBeDefined()
          expect(m).toMatchObject({ type: expect.any(String) })
        }
      })
    })

    describe('process revisions passed to DiffLineInterpreter (kills L79:79 and L87:79 ObjectLiteral {})', () => {
      const firstSHA = 'first-sha-000'

      beforeEach(() => {
        mockGetFilesPath.mockReturnValue(['test'])
        mockGetFirstCommitRef.mockResolvedValue(firstSHA)
      })

      it('Then ADDITION process is called with from=firstSHA, to=config.to', async () => {
        // Arrange — keep only deletion lines so only ADDITION lines are collected
        config.include = '.sgdinclude'
        config.to = 'HEAD'
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('D')) as typeof mockKeep)
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        await sut.transformAndCollect(new ChangeSet())

        // Assert — kills ObjectLiteral {} replacing { from: firstSHA, to: config.to }
        expect(mockProcess).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({ from: firstSHA, to: 'HEAD' })
        )
      })

      it('Then DELETION process is called with from=config.to, to=firstSHA', async () => {
        // Arrange — keep only addition lines so only DELETION lines are collected
        config.include = '.sgdinclude'
        config.to = 'HEAD'
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('A')) as typeof mockKeep)
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        await sut.transformAndCollect(new ChangeSet())

        // Assert — kills ObjectLiteral {} replacing { from: config.to, to: firstSHA }
        expect(mockProcess).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({ from: 'HEAD', to: firstSHA })
        )
      })
    })
  })

  describe('when includeDestructive is configured', () => {
    beforeAll(() => {
      mockGetFilesPath.mockImplementation(() => ['test'])
    })
    describe('when no file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(true)
      })
      it('Then returns an empty result', async () => {
        // Arrange
        config.includeDestructive = '.sgdincludedestructive'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(result).toEqual(emptyResult())
      })
    })

    describe('when file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(false)
      })
      it('Then collects the destructive include entry', async () => {
        // Arrange
        config.includeDestructive = '.sgdincludedestructive'
        const sut = new IncludeProcessor(config, metadata, treeIndexes)

        // Act
        const result = await sut.transformAndCollect(new ChangeSet())

        // Assert
        expect(elementsOf(result)).toContainEqual(includedManifest)
      })
    })
  })
})
