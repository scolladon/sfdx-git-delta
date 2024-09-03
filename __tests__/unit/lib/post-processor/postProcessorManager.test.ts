'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import BaseProcessor from '../../../../src/post-processor/baseProcessor'
import PostProcessorManager, {
  getPostProcessors,
} from '../../../../src/post-processor/postProcessorManager'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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
    metadata = await getGlobalMetadata()
  })

  describe('getPostProcessors', () => {
    describe('when called', () => {
      it('returns a post processor manager with a list of post processor', () => {
        // Arrange
        const sut = getPostProcessors

        // Act
        const result = sut(work, metadata)

        // Assert
        expect(result['postProcessors'].length).toBeGreaterThan(0)
      })
    })
  })
  describe('when calling `use`', () => {
    it('should add a processor to the list', () => {
      // Arrange
      const sut = new PostProcessorManager(work)
      const processorCount = sut['postProcessors'].length

      // Act
      sut.use(new TestProcessor(work, metadata) as BaseProcessor)

      // Assert
      expect(processorCount).toBeLessThan(sut['postProcessors'].length)
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
})
