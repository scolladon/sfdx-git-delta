'use strict'
const BaseProcessor = require('../../../../src/post-processor/baseProcessor')

describe('BaseProcessor', () => {
  describe('when process is called', () => {
    it('throws an error', async () => {
      // Arrange
      expect.assertions(1)
      const sut = new BaseProcessor({})

      // Act
      try {
        await sut.process()
      } catch (error) {
        // Assert
        expect(error.message).toEqual('this class should be derived')
      }
    })
  })
})
