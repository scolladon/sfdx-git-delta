'use strict'
const {
  getPostProcessors,
} = require('../../../../src/post-processor/postProcessorManager')
const PostProcessorManager = require('../../../../src/post-processor/postProcessorManager')
const BaseProcessor = require('../../../../src/post-processor/baseProcessor')

const processSpy = jest.fn()

class TestProcesor extends BaseProcessor {
  constructor() {
    super({})
  }
  process = processSpy
}

describe('postProcessorManager', () => {
  const work = {}
  describe('getPostProcessors', () => {
    describe('when called', () => {
      it('returns a post processor manager with a list of post processor', () => {
        // Arrange
        const sut = getPostProcessors

        // Act
        const result = sut(work)

        // Assert
        expect(result.postProcessors.length).toBeGreaterThan(0)
      })
    })
  })
  describe('when calling `use`', () => {
    it('should add a processor to the list', () => {
      // Arrange
      const sut = new PostProcessorManager()
      const processorCount = sut.postProcessors.length

      // Act
      sut.use(new TestProcesor())

      // Assert
      expect(processorCount).toBeLessThan(sut.postProcessors.length)
    })
  })

  describe.each([
    [new PostProcessorManager(), 0],
    [new PostProcessorManager().use(new TestProcesor()), 1],
    [
      new PostProcessorManager()
        .use(new TestProcesor())
        .use(new TestProcesor()),
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

  describe('when postProcessor `process` throws', () => {
    it('should throw', async () => {
      // Arrange
      expect.assertions(1)
      const sut = new PostProcessorManager()
      sut.use(new TestProcesor())
      processSpy.mockImplementationOnce(() => Promise.reject('Error'))

      // Act
      try {
        await sut.execute()
      } catch (error) {
        // Assert
        expect(error).toEqual('Error')
      }
    })
  })
})
