'use strict'
import { BoundedQueue } from './boundedQueue.js'

export const eachLimit = async <T>(
  items: Iterable<T>,
  limit: number,
  iteratee: (item: T) => Promise<void>
): Promise<void> => {
  const queue = new BoundedQueue<T>(iteratee, limit)
  for (const item of items) queue.push(item)
  await queue.drain()
}
