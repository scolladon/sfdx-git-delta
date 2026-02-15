'use strict'
import { availableParallelism } from 'node:os'

/**
 * Maximum concurrency limit to prevent resource exhaustion in CI environments.
 * See: https://github.com/scolladon/sfdx-git-delta/issues/762#issuecomment-1907609957
 */
const MAX_CONCURRENCY = 6

/**
 * Returns the appropriate concurrency threshold based on available system parallelism.
 * Caps at MAX_CONCURRENCY to prevent resource exhaustion in CI environments.
 */
export const getConcurrencyThreshold = (): number => {
  const available = availableParallelism ? availableParallelism() : Infinity
  return Math.min(available, MAX_CONCURRENCY)
}
