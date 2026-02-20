'use strict'

/**
 * Appends all elements from source arrays to target array.
 * Stack-safe alternative to target.push(...source) which can overflow on large arrays.
 */
export const pushAll = <T>(target: T[], ...sources: T[][]): void => {
  for (const source of sources) {
    for (const item of source) {
      target.push(item)
    }
  }
}
