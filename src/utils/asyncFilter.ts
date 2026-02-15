import { filterLimit } from 'async'

import { getConcurrencyThreshold } from './concurrencyUtils.js'

const asyncFilter = async (
  list: string[],
  predicate: (t: string) => Promise<boolean>
): Promise<string[]> => {
  return filterLimit(list, getConcurrencyThreshold(), predicate)
}
export default asyncFilter
