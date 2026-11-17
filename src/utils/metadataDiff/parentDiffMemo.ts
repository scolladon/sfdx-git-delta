'use strict'
import type { DiffOutcome } from './index.js'

export type ParentDiffs = Readonly<{
  outcomeOf(
    path: string,
    diff: () => Promise<DiffOutcome>
  ): Promise<DiffOutcome>
}>

// A fresh Map per call, never a shared constant: a shared default would be
// mutable state across runs.
export const createParentDiffMemo = (): ParentDiffs => {
  const outcomes = new Map<string, Promise<DiffOutcome>>()
  return {
    // Not async: the read and the write share one synchronous turn, so
    // concurrent children of one parent join the same diff.
    outcomeOf(path, diff) {
      const memoized = outcomes.get(path)
      if (memoized) return memoized
      const pending = diff().catch((error: unknown) => {
        outcomes.delete(path)
        throw error
      })
      outcomes.set(path, pending)
      return pending
    },
  }
}
