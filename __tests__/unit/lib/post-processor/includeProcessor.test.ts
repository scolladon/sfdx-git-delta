'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import {
  CopyOperationKind,
  emptyResult,
  type HandlerResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import {
  buildIncludeHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/testWork'

const { mockProcess, mockGetFilesPath } = vi.hoisted(() => ({
  mockProcess: vi.fn<() => Promise<HandlerResult>>(),
  mockGetFilesPath: vi.fn(),
}))

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
      getFilesPath: mockGetFilesPath,
      getFirstCommitRef: vi.fn(),
    })),
  },
}))

vi.mock('../../../../src/utils/ignoreHelper')
const mockedBuildIncludeHelper = vi.mocked(buildIncludeHelper)

const mockKeep = vi.fn()
mockedBuildIncludeHelper.mockResolvedValue({
  keep: mockKeep,
} as unknown as IgnoreHelper)

describe('IncludeProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  const includedManifest = {
    target: ManifestTarget.Package,
    type: 'ApexClass',
    member: 'Included',
  }
  const includedCopy = {
    kind: CopyOperationKind.GitCopy,
    source: { path: 'src/included.cls', oid: 'HEAD' },
    target: 'included.cls',
  }

  beforeEach(() => {
    work = getWork()
    vi.clearAllMocks()
    mockProcess.mockResolvedValue({
      manifests: [includedManifest],
      copies: [includedCopy],
      warnings: [],
    })
  })

  describe('process', () => {
    it('Given IncludeProcessor, When process is called, Then it is a no-op', async () => {
      // Arrange
      const sut = new IncludeProcessor(work, metadata)

      // Act & Assert
      await expect(sut.process()).resolves.toBeUndefined()
    })
  })

  describe('when no include is configured', () => {
    it('does not process include', async () => {
      // Arrange
      const sut = new IncludeProcessor(work, metadata)

      // Act
      const result = await sut.transformAndCollect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(mockedBuildIncludeHelper).not.toHaveBeenCalled()
    })
  })

  describe('when include is configured', () => {
    beforeAll(() => {
      mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
    })

    describe('when no file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(true)
      })
      it('Then returns an empty result', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(result).toEqual(emptyResult())
      })
    })

    describe('when file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(false)
      })
      it('Then aggregates the processed manifest and copy into the result', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(result.manifests.length).toBeGreaterThan(0)
        expect(result.manifests).toContainEqual(includedManifest)
        expect(result.copies).toContainEqual(includedCopy)
      })
    })

    describe('when multiple files match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() =>
          Promise.resolve(['test1', 'test2'])
        )
        mockKeep.mockReturnValue(false)
      })
      it('Then aggregates at least one manifest entry per matched file', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)
        const baseline = (
          await new IncludeProcessor(getWork(), metadata).transformAndCollect()
        ).manifests.length

        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(result.manifests.length).toBeGreaterThan(baseline)
        expect(result.manifests).toContainEqual(includedManifest)
      })
    })

    describe('when only additions match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
        // Keep deletion lines, reject addition lines
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('D')) as typeof mockKeep)
      })
      it('Then collects include manifest entries (additions only)', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(result.manifests).toContainEqual(includedManifest)
      })
    })

    describe('when only deletions match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
        // Keep addition lines, reject deletion lines
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('A')) as typeof mockKeep)
      })
      it('Then collects include manifest entries (deletions only)', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(result.manifests).toContainEqual(includedManifest)
      })
    })
  })

  describe('when includeDestructive is configured', () => {
    beforeAll(() => {
      mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
    })
    describe('when no file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(true)
      })
      it('Then returns an empty result', async () => {
        // Arrange
        work.config.includeDestructive = '.sgdincludedestructive'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        const result = await sut.transformAndCollect()

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
        work.config.includeDestructive = '.sgdincludedestructive'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(result.manifests).toContainEqual(includedManifest)
      })
    })
  })
})
