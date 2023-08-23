/*
const asyncFilter = async (arr: string[], predicate: Function) =>
  arr.reduce(
    async (memo: Promise<string[]>, e: string) =>
      (await predicate(e)) ? [...(await memo), e] : memo,
    []
  )
export default asyncFilter
*/

const asyncFilter = async (
  list: string[],
  // eslint-disable-next-line no-unused-vars
  predicate: (t: string) => Promise<boolean>
) => {
  const resolvedPredicates = await Promise.all(list.map(predicate))
  return list.filter((_, idx) => resolvedPredicates[idx])
}
export default asyncFilter
