'use strict'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

describe('getConcurrencyThreshold', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  describe('Given availableParallelism returns a value less than max', () => {
    it('When called, Then returns the available parallelism', async () => {
      // Arrange
      jest.doMock('node:os', () => ({
        availableParallelism: () => 4,
      }))
      const { getConcurrencyThreshold } = await import(
        '../../../../src/utils/concurrencyUtils'
      )

      // Act
      const result = getConcurrencyThreshold()

      // Assert
      expect(result).toBe(4)
    })
  })

  describe('Given availableParallelism returns a value greater than max', () => {
    it('When called, Then returns the max concurrency (6)', async () => {
      // Arrange
      jest.doMock('node:os', () => ({
        availableParallelism: () => 16,
      }))
      const { getConcurrencyThreshold } = await import(
        '../../../../src/utils/concurrencyUtils'
      )

      // Act
      const result = getConcurrencyThreshold()

      // Assert
      expect(result).toBe(6)
    })
  })

  describe('Given availableParallelism returns exactly max', () => {
    it('When called, Then returns the max concurrency (6)', async () => {
      // Arrange
      jest.doMock('node:os', () => ({
        availableParallelism: () => 6,
      }))
      const { getConcurrencyThreshold } = await import(
        '../../../../src/utils/concurrencyUtils'
      )

      // Act
      const result = getConcurrencyThreshold()

      // Assert
      expect(result).toBe(6)
    })
  })

  describe('Given availableParallelism is undefined', () => {
    it('When called, Then returns the max concurrency (6)', async () => {
      // Arrange
      jest.doMock('node:os', () => ({
        availableParallelism: undefined,
      }))
      const { getConcurrencyThreshold } = await import(
        '../../../../src/utils/concurrencyUtils'
      )

      // Act
      const result = getConcurrencyThreshold()

      // Assert
      expect(result).toBe(6)
    })
  })
})
