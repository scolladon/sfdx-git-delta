'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BaseProcessor from '../../../../src/post-processor/baseProcessor'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import PostProcessorManager, {
  getPostProcessors,
} from '../../../../src/post-processor/postProcessorManager'
import {
  type HandlerResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/adapter/GitAdapter')
vi.mock('../../../../src/utils/LoggingService')

const processSpy = vi.fn()

class TestProcessor extends BaseProcessor {
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
  }
  override async process() {
    return processSpy() as Promise<void>
  }
}

class TestCollector extends BaseProcessor {
  public mockResult: HandlerResult = {
    manifests: [],
    copies: [],
    warnings: [],
  }
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
  }
  override get isCollector(): boolean {
    return true
  }
  override async process() {}
  override async transformAndCollect(): Promise<HandlerResult> {
    return this.mockResult
  }
}

describe('postProcessorManager', () => {
  let work: Work
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  beforeEach(() => {
    vi.clearAllMocks()
    work = getWork()
  })

  describe('getPostProcessors', () => {
    it('Given work and metadata, When called, Then returns manager that can execute', async () => {
      // Arrange
      const sut = getPostProcessors(work, metadata)

      // Act & Assert
      await expect(sut.collectAll()).resolves.toBeDefined()
    })
  })
  describe('when calling `use`', () => {
    it('Given a new processor, When use is called, Then execute invokes it', async () => {
      // Arrange
      const sut = new PostProcessorManager(work)
      sut.use(new TestProcessor(work, metadata) as BaseProcessor)

      // Act
      await sut.execute()

      // Assert
      expect(processSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('processor count', () => {
    describe.each([
      0, 1, 2,
    ])('when calling `execute` with %i processors', expectedCount => {
      it(`should execute ${expectedCount} processors`, async () => {
        // Arrange
        const localWork = getWork()
        const sut = new PostProcessorManager(localWork)
        for (let i = 0; i < expectedCount; i++) {
          sut.use(new TestProcessor(localWork, metadata) as BaseProcessor)
        }

        // Act
        await sut.execute()

        // Assert
        expect(processSpy).toHaveBeenCalledTimes(expectedCount)
      })
    })
  })

  describe('when postProcessor `process` throws', () => {
    it('should append the error in warnings with processor class name', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      sut.use(new TestProcessor(localWork, metadata) as BaseProcessor)
      processSpy.mockImplementationOnce(() =>
        Promise.reject(new Error('Some error'))
      )

      // Act
      await sut.execute()

      // Assert
      expect(localWork.warnings).toHaveLength(1)
      expect(localWork.warnings[0].message).toContain('TestProcessor')
      expect(localWork.warnings[0].message).toContain('Some error')
    })
  })

  describe('executeRemaining', () => {
    it('Given processors including IncludeProcessor, When executeRemaining, Then skips IncludeProcessor', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      sut.use(new TestProcessor(localWork, metadata) as BaseProcessor)
      sut.use(new IncludeProcessor(localWork, metadata) as BaseProcessor)
      sut.use(new TestProcessor(localWork, metadata) as BaseProcessor)

      // Act
      await sut.executeRemaining()

      // Assert
      expect(processSpy).toHaveBeenCalledTimes(2)
    })

    it('Given processor that throws, When executeRemaining, Then appends error to warnings', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      sut.use(new TestProcessor(localWork, metadata) as BaseProcessor)
      processSpy.mockImplementationOnce(() =>
        Promise.reject(new Error('executeRemaining error'))
      )

      // Act
      await sut.executeRemaining()

      // Assert
      expect(localWork.warnings).toHaveLength(1)
      expect(localWork.warnings[0].message).toContain('executeRemaining error')
    })
  })

  describe('collectAll', () => {
    it('Given no IncludeProcessor, When collectAll, Then returns empty result', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      sut.use(new TestProcessor(localWork, metadata) as BaseProcessor)

      // Act
      const result = await sut.collectAll()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('Given collector with results, When collectAll, Then returns merged result', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      const collector = new TestCollector(localWork, metadata)
      collector.mockResult = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'Test',
          },
        ],
        copies: [],
        warnings: [],
      }
      sut.use(collector as BaseProcessor)

      // Act
      const result = await sut.collectAll()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0].type).toBe('ApexClass')
    })

    it('Given IncludeProcessor that throws, When collectAll, Then returns result with warnings', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      const includeProcessor = new IncludeProcessor(localWork, metadata)
      vi.spyOn(includeProcessor, 'transformAndCollect').mockRejectedValueOnce(
        new Error('collectAll error')
      )
      sut.use(includeProcessor as BaseProcessor)

      // Act
      const result = await sut.collectAll()

      // Assert
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('collectAll error')
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
    })
  })
})
