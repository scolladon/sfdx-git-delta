'use strict'
import { describe, expect, it } from '@jest/globals'

import asyncFilter from '../../../../src/utils/asyncFilter'

describe('asyncFilter', () => {
  describe('Given an empty list', () => {
    it('When filtering, Then returns empty list', async () => {
      // Arrange
      const list: string[] = []
      const predicate = async () => true

      // Act
      const result = await asyncFilter(list, predicate)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given a list with elements', () => {
    it('When all predicates return true, Then returns full list', async () => {
      // Arrange
      const list = ['a', 'b', 'c']
      const predicate = async () => true

      // Act
      const result = await asyncFilter(list, predicate)

      // Assert
      expect(result).toEqual(['a', 'b', 'c'])
    })

    it('When all predicates return false, Then returns empty list', async () => {
      // Arrange
      const list = ['a', 'b', 'c']
      const predicate = async () => false

      // Act
      const result = await asyncFilter(list, predicate)

      // Assert
      expect(result).toEqual([])
    })

    it('When predicates return mixed results, Then filters correctly', async () => {
      // Arrange
      const list = ['a', 'bb', 'ccc', 'd']
      const predicate = async (s: string) => s.length > 1

      // Act
      const result = await asyncFilter(list, predicate)

      // Assert
      expect(result).toEqual(['bb', 'ccc'])
    })
  })

  describe('Given concurrent operations', () => {
    it('When filtering large list, Then respects concurrency limit', async () => {
      // Arrange
      const list = Array.from({ length: 100 }, (_, i) => `item-${i}`)
      let maxConcurrent = 0
      let currentConcurrent = 0

      const predicate = async (s: string) => {
        currentConcurrent++
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
        await new Promise(resolve => setTimeout(resolve, 10))
        currentConcurrent--
        return s.includes('5')
      }

      // Act
      const result = await asyncFilter(list, predicate)

      // Assert
      expect(result).toContain('item-5')
      expect(result).toContain('item-50')
      expect(result).toContain('item-55')
      expect(maxConcurrent).toBeLessThanOrEqual(50) // CONCURRENCY_LIMIT
    })
  })

  describe('Given a predicate that throws', () => {
    it('When error occurs, Then error propagates', async () => {
      // Arrange
      const list = ['a', 'b', 'c']
      const error = new Error('predicate error')
      const predicate = async () => {
        throw error
      }

      // Act & Assert
      await expect(asyncFilter(list, predicate)).rejects.toThrow(
        'predicate error'
      )
    })
  })
})
