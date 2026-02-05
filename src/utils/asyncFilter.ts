const asyncFilter = async (
  list: string[],
  predicate: (t: string) => Promise<boolean>
) => {
  const resolvedPredicates = await Promise.all(list.map(predicate))
  return list.filter((_, idx) => resolvedPredicates[idx])
}
export default asyncFilter
