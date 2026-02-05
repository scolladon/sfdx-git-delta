const BATCH_SIZE = 50

const asyncFilter = async (
  list: string[],
  predicate: (t: string) => Promise<boolean>
) => {
  const resolvedPredicates: boolean[] = []

  // Process in batches to avoid overwhelming I/O with huge arrays
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(batch.map(predicate))
    resolvedPredicates.push(...batchResults)
  }

  return list.filter((_, idx) => resolvedPredicates[idx])
}
export default asyncFilter
