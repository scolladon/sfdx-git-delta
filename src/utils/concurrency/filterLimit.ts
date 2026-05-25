'use strict'
import { eachLimit } from './eachLimit.js'

export const filterLimit = async <T>(
  items: readonly T[],
  limit: number,
  predicate: (item: T) => Promise<boolean>
): Promise<T[]> => {
  const verdicts = new Array<boolean>(items.length)
  await eachLimit(items.keys(), limit, async (index: number) => {
    verdicts[index] = await predicate(items[index] as T)
  })
  return items.filter((_, index) => verdicts[index])
}
