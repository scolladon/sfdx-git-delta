'use strict'
import { setImmediate } from 'node:timers/promises'

import { describe, expect, it, vi } from 'vitest'

import { eachLimit } from '../../../../../src/utils/concurrency/eachLimit'

const microtask = () => setImmediate()

describe('eachLimit', () => {
  describe('Given an empty iterable', () => {
    it('When invoked, Then iteratee is never called and the promise resolves', async () => {
      // Arrange
      const iteratee = vi.fn(async () => undefined)

      // Act
      await eachLimit([], 3, iteratee)

      // Assert
      expect(iteratee).not.toHaveBeenCalled()
    })
  })

  describe('Given a list of items', () => {
    it('When iteratee is async, Then every item is visited exactly once', async () => {
      // Arrange
      const seen: number[] = []

      // Act
      await eachLimit([1, 2, 3, 4, 5], 2, async (n: number) => {
        await microtask()
        seen.push(n)
      })

      // Assert
      expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    })

    it('When more items than the limit, Then concurrent workers cap at the limit', async () => {
      // Arrange
      let active = 0
      let peak = 0
      const limit = 3

      // Act
      await eachLimit(
        Array.from({ length: 20 }, (_, i) => i),
        limit,
        async () => {
          active++
          peak = Math.max(peak, active)
          await microtask()
          active--
        }
      )

      // Assert
      expect(peak).toBe(limit)
    })
  })

  describe('Given an iteratee that throws', () => {
    it('When invoked, Then the rejection propagates', async () => {
      // Arrange
      const boom = new Error('iteratee failed')

      // Act / Assert
      await expect(
        eachLimit([1, 2, 3], 2, async () => {
          throw boom
        })
      ).rejects.toBe(boom)
    })
  })

  describe('Given an arbitrary iterable', () => {
    it('When given a Set, Then every element is visited', async () => {
      // Arrange
      const seen = new Set<number>()
      const items = new Set([10, 20, 30])

      // Act
      await eachLimit(items, 2, async (n: number) => {
        seen.add(n)
      })

      // Assert
      expect(seen).toEqual(items)
    })
  })
})
