'use strict'
import { setImmediate } from 'node:timers/promises'

import { describe, expect, it } from 'vitest'

import { filterLimit } from '../../../../../src/utils/concurrency/filterLimit'

describe('filterLimit', () => {
  describe('Given an empty list', () => {
    it('When filtering, Then returns an empty list', async () => {
      // Arrange / Act
      const result = await filterLimit<number>([], 2, async () => true)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given a populated list', () => {
    it('When predicate always returns true, Then returns the full list', async () => {
      // Arrange / Act
      const result = await filterLimit([1, 2, 3], 2, async () => true)

      // Assert
      expect(result).toEqual([1, 2, 3])
    })

    it('When predicate always returns false, Then returns an empty list', async () => {
      // Arrange / Act
      const result = await filterLimit([1, 2, 3], 2, async () => false)

      // Assert
      expect(result).toEqual([])
    })

    it('When predicate returns mixed verdicts, Then preserves input order in the result', async () => {
      // Arrange
      const items = ['a', 'bb', 'ccc', 'd', 'eeee']

      // Act
      const result = await filterLimit(
        items,
        2,
        async (s: string) => s.length > 1
      )

      // Assert
      expect(result).toEqual(['bb', 'ccc', 'eeee'])
    })

    it('When predicates finish out of order, Then output order still follows input order', async () => {
      // Arrange — high indices intentionally resolve faster than low ones
      const items = [0, 1, 2, 3, 4, 5]

      // Act
      const result = await filterLimit(items, 3, async (n: number) => {
        await setImmediate()
        if (n % 2 === 0) await setImmediate()
        return true
      })

      // Assert
      expect(result).toEqual(items)
    })
  })

  describe('Given more items than the concurrency limit', () => {
    it('When filtering, Then never exceeds the limit', async () => {
      // Arrange
      let active = 0
      let peak = 0
      const limit = 3
      const items = Array.from({ length: 20 }, (_, i) => i)

      // Act
      await filterLimit(items, limit, async () => {
        active++
        peak = Math.max(peak, active)
        await setImmediate()
        active--
        return true
      })

      // Assert
      expect(peak).toBe(limit)
    })
  })

  describe('Given a predicate that throws', () => {
    it('When filtering, Then the rejection propagates', async () => {
      // Arrange
      const boom = new Error('predicate failed')

      // Act / Assert
      await expect(
        filterLimit([1, 2, 3], 2, async () => {
          throw boom
        })
      ).rejects.toBe(boom)
    })
  })
})
