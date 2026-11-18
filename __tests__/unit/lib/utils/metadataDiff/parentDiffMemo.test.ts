'use strict'
import { describe, expect, it, vi } from 'vitest'

import type { DiffOutcome } from '../../../../../src/utils/metadataDiff/index'
import { createParentDiffMemo } from '../../../../../src/utils/metadataDiff/parentDiffMemo'

const outcome = (): DiffOutcome => ({
  manifests: { added: [], modified: [], deleted: [] },
  hasPackageContent: false,
})

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('Given a parent diff memo', () => {
  it('When the same path is asked twice, Then the diff runs once and both callers get the same promise', () => {
    // Arrange
    const sut = createParentDiffMemo()
    const diff = vi.fn().mockResolvedValue(outcome())

    // Act
    const first = sut.outcomeOf('a.xml', diff)
    const second = sut.outcomeOf('a.xml', diff)

    // Assert
    expect(diff).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('When two paths are asked, Then each path diff runs once', async () => {
    // Arrange
    const sut = createParentDiffMemo()
    const diffA = vi.fn().mockResolvedValue(outcome())
    const diffB = vi.fn().mockResolvedValue(outcome())

    // Act
    await sut.outcomeOf('a.xml', diffA)
    await sut.outcomeOf('b.xml', diffB)
    await sut.outcomeOf('a.xml', diffA)
    await sut.outcomeOf('b.xml', diffB)

    // Assert
    expect(diffA).toHaveBeenCalledTimes(1)
    expect(diffB).toHaveBeenCalledTimes(1)
  })

  it('When two callers ask before the first diff settles, Then the diff runs once', async () => {
    // Arrange
    const sut = createParentDiffMemo()
    const pending = deferred<DiffOutcome>()
    const diff = vi.fn().mockReturnValue(pending.promise)

    // Act
    const first = sut.outcomeOf('a.xml', diff)
    const second = sut.outcomeOf('a.xml', diff)
    const expected = outcome()
    pending.resolve(expected)
    const results = await Promise.all([first, second])

    // Assert
    expect(diff).toHaveBeenCalledTimes(1)
    expect(results).toEqual([expected, expected])
  })

  it('When the diff rejects, Then both joined callers reject with that error and the next call runs the diff again', async () => {
    // Arrange
    const sut = createParentDiffMemo()
    const error = new Error('diff failed')
    const pending = deferred<DiffOutcome>()
    const failing = vi.fn().mockReturnValue(pending.promise)
    const retry = vi.fn().mockResolvedValue(outcome())

    // Act
    const first = sut.outcomeOf('a.xml', failing)
    const second = sut.outcomeOf('a.xml', failing)
    pending.reject(error)

    // Assert
    await expect(first).rejects.toBe(error)
    await expect(second).rejects.toBe(error)
    await sut.outcomeOf('a.xml', retry)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('When two memos are created, Then a path diffed in one is diffed again in the other', async () => {
    // Arrange
    const sut = createParentDiffMemo()
    const other = createParentDiffMemo()
    const diff = vi.fn().mockResolvedValue(outcome())

    // Act
    await sut.outcomeOf('a.xml', diff)
    await other.outcomeOf('a.xml', diff)

    // Assert
    expect(diff).toHaveBeenCalledTimes(2)
  })
})
