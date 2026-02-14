'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BaseProcessor from '../../../../src/post-processor/baseProcessor'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import PostProcessorManager, {
  getPostProcessors,
} from '../../../../src/post-processor/postProcessorManager'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/adapter/GitAdapter')

const processSpy = jest.fn()

class TestProcessor extends BaseProcessor {
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
  }
  override async process() {
    return processSpy() as Promise<void>
  }
}

describe('postProcessorManager', () => {
  const work: Work = getWork()
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  describe('getPostProcessors', () => {
    describe('when called', () => {
      it('returns a post processor manager with a list of post processor', () => {
        // Arrange
        const sut = getPostProcessors

        // Act
        const result = sut(work, metadata)

        // Assert
        expect(
          result['processors'].length + result['collectors'].length
        ).toBeGreaterThan(0)
      })
    })
  })
  describe('when calling `use`', () => {
    it('should add a processor to the list', () => {
      // Arrange
      const sut = new PostProcessorManager(work)
      const processorCount = sut['processors'].length

      // Act
      sut.use(new TestProcessor(work, metadata) as BaseProcessor)

      // Assert
      expect(processorCount).toBeLessThan(sut['processors'].length)
    })
  })

  describe('processor count', () => {
    describe.each([
      [new PostProcessorManager(work), 0],
      [
        new PostProcessorManager(work).use(
          new TestProcessor(work, metadata) as BaseProcessor
        ),
        1,
      ],
      [
        new PostProcessorManager(work)
          .use(new TestProcessor(work, metadata) as BaseProcessor)
          .use(new TestProcessor(work, metadata) as BaseProcessor),
        2,
      ],
    ])('when calling `execute`', (processorManager, expectedCount) => {
      it(`should execute ${expectedCount} processors`, async () => {
        // Arrange
        const sut = processorManager

        // Act
        await sut.execute()

        // Assert
        expect(processSpy).toHaveBeenCalledTimes(expectedCount)
      })
    })
  })

  describe('when postProcessor `process` throws', () => {
    it('should append the error in warnings', async () => {
      // Arrange
      expect.assertions(1)
      const sut = new PostProcessorManager(work)
      sut.use(new TestProcessor(work, metadata) as BaseProcessor)
      processSpy.mockImplementationOnce(() =>
        Promise.reject(new Error('Error'))
      )

      // Act
      await sut.execute()
      expect(work.warnings.length).toBe(1)
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

    it('Given IncludeProcessor that throws, When collectAll, Then returns result with warnings', async () => {
      // Arrange
      const localWork = getWork()
      const sut = new PostProcessorManager(localWork)
      const includeProcessor = new IncludeProcessor(localWork, metadata)
      jest
        .spyOn(includeProcessor, 'transformAndCollect')
        .mockRejectedValueOnce(new Error('collectAll error'))
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
