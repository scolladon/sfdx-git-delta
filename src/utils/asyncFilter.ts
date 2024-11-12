const asyncFilter = async (
  list: string[],
  predicate: (t: string) => Promise<boolean>
) => {
  const resolvedPredicates: boolean[] = []
  for (const elem of list) {
    const predicateResult = await predicate(elem)
    resolvedPredicates.push(predicateResult)
  }
  return list.filter((_, idx) => resolvedPredicates[idx])
}
export default asyncFilter
