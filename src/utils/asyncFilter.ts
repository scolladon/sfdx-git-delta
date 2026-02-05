import { filterLimit } from 'async'

const CONCURRENCY_LIMIT = 50

const asyncFilter = async (
  list: string[],
  predicate: (t: string) => Promise<boolean>
): Promise<string[]> => {
  return filterLimit(list, CONCURRENCY_LIMIT, predicate)
}
export default asyncFilter
