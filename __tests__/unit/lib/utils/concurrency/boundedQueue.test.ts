'use strict'
import { setImmediate } from 'node:timers/promises'

import { describe, expect, it, vi } from 'vitest'

import { BoundedQueue } from '../../../../../src/utils/concurrency/boundedQueue'

const microtask = () => setImmediate()

describe('BoundedQueue', () => {
  describe('Given an empty queue', () => {
    it('When constructed, Then idle returns true', () => {
      // Arrange
      const sut = new BoundedQueue<number>(async () => undefined, 2)

      // Act / Assert
      expect(sut.idle()).toBe(true)
    })

    it('When drain is called, Then it resolves immediately', async () => {
      // Arrange
      const sut = new BoundedQueue<number>(async () => undefined, 2)

      // Act
      await sut.drain()

      // Assert — reaching this line means drain resolved
      expect(sut.idle()).toBe(true)
    })
  })

  describe('Given items pushed within the concurrency limit', () => {
    it('When draining, Then every worker is invoked exactly once', async () => {
      // Arrange
      const worker = vi.fn(async () => undefined)
      const sut = new BoundedQueue<number>(worker, 2)

      // Act
      sut.push(1)
      sut.push(2)
      await sut.drain()

      // Assert
      expect(worker).toHaveBeenCalledTimes(2)
      expect(worker).toHaveBeenCalledWith(1)
      expect(worker).toHaveBeenCalledWith(2)
      expect(sut.idle()).toBe(true)
    })
  })

  describe('Given more items than the concurrency limit', () => {
    it('When draining, Then concurrent workers never exceed the limit', async () => {
      // Arrange
      let active = 0
      let peak = 0
      const limit = 3
      const worker = async () => {
        active++
        peak = Math.max(peak, active)
        await microtask()
        active--
      }
      const sut = new BoundedQueue<number>(worker, limit)

      // Act
      for (let i = 0; i < 12; i++) sut.push(i)
      await sut.drain()

      // Assert
      expect(peak).toBeLessThanOrEqual(limit)
      expect(peak).toBe(limit)
      expect(sut.idle()).toBe(true)
    })

    it('When draining, Then every queued item is processed', async () => {
      // Arrange
      const seen: number[] = []
      const sut = new BoundedQueue<number>(async (n: number) => {
        await microtask()
        seen.push(n)
      }, 2)

      // Act
      for (let i = 0; i < 5; i++) sut.push(i)
      await sut.drain()

      // Assert
      expect(seen.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    })
  })

  describe('Given drain is called concurrently', () => {
    it('When workers finish, Then every waiter resolves', async () => {
      // Arrange
      const sut = new BoundedQueue<number>(async () => {
        await microtask()
      }, 2)

      // Act
      sut.push(1)
      sut.push(2)
      sut.push(3)
      const drainPromises = [sut.drain(), sut.drain(), sut.drain()]
      await Promise.all(drainPromises)

      // Assert
      expect(sut.idle()).toBe(true)
    })
  })

  describe('Given a worker that throws', () => {
    it('When draining, Then drain rejects with the original error', async () => {
      // Arrange
      const boom = new Error('worker exploded')
      const sut = new BoundedQueue<number>(async () => {
        throw boom
      }, 2)

      // Act
      sut.push(1)

      // Assert
      await expect(sut.drain()).rejects.toBe(boom)
    })

    it('When draining, Then concurrent waiters all reject with the same error', async () => {
      // Arrange
      const boom = new Error('worker exploded')
      const sut = new BoundedQueue<number>(async () => {
        await microtask()
        throw boom
      }, 2)

      // Act
      sut.push(1)
      sut.push(2)
      const results = await Promise.allSettled([sut.drain(), sut.drain()])

      // Assert
      expect(results).toHaveLength(2)
      for (const r of results) {
        expect(r.status).toBe('rejected')
        if (r.status === 'rejected') expect(r.reason).toBe(boom)
      }
    })

    it('When push is called after the error, Then it silently no-ops', async () => {
      // Arrange
      const boom = new Error('worker exploded')
      const worker = vi.fn(async () => {
        throw boom
      })
      const sut = new BoundedQueue<number>(worker, 2)

      // Act
      sut.push(1)
      await expect(sut.drain()).rejects.toBe(boom)
      const callCountAfterFirstDrain = worker.mock.calls.length
      sut.push(2)
      sut.push(3)
      await microtask()

      // Assert
      expect(worker.mock.calls.length).toBe(callCountAfterFirstDrain)
    })

    it('When drain is awaited after the error has already fired, Then it rejects with the captured error', async () => {
      // Arrange
      const boom = new Error('worker exploded')
      const sut = new BoundedQueue<number>(async () => {
        throw boom
      }, 2)

      // Act
      sut.push(1)
      await expect(sut.drain()).rejects.toBe(boom)

      // Assert — second drain after rejection still rejects
      await expect(sut.drain()).rejects.toBe(boom)
    })
  })
})
