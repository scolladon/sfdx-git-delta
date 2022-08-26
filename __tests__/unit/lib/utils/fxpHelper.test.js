'use strict'
const { asArray } = require('../../../../src/utils/fxpHelper')

describe('asArray', () => {
  describe('when called with null', () => {
    // Arrange
    const expected = null

    it('returns empty array', () => {
      // Act
      const actual = asArray(expected)

      // Assert
      expect(actual).toEqual([])
    })
  })
  describe('when called with array', () => {
    // Arrange
    const expected = [{ test: true }]

    it('returns the same array', () => {
      // Act
      const actual = asArray(expected)

      // Assert
      expect(actual).toBe(expected)
    })
  })
  describe('when called with object', () => {
    // Arrange
    const expected = { test: true }

    it('returns the array with this object', () => {
      // Act
      const actual = asArray(expected)

      // Assert
      expect(actual).toEqual([expected])
    })
  })
})
