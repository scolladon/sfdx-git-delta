module.exports = async (arr, predicate) =>
  arr.reduce(
    async (memo, e) => ((await predicate(e)) ? [...(await memo), e] : memo),
    []
  )
