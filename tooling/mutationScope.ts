// Computes the incremental mutation-testing scope from a plain git diff and
// the mutate config's own negations. Kept apart from the run shell — which
// exits the process and so never loads under the unit run — so this glob
// logic is itself unit-tested.

export const escapeGlobLiteral = (chunk: string): string =>
  chunk.replace(/[.+^${}()|[\]\\]/g, '\\$&')

export const convertGlobWildcards = (chunk: string): string =>
  escapeGlobLiteral(chunk).replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')

// Supports two globstar forms, matching the negations this project writes:
// a mid-pattern `**/` (zero or more directories) and a trailing `/**`
// (the directory itself plus everything under it, any depth). A bare `**`
// anywhere else (e.g. `a**b`) is not a globstar here — it degrades to two
// single-segment wildcards, same as before this function grew `**` support.
const TRAILING_GLOBSTAR = /\/\*\*$/

export const globToRegExp = (pattern: string): RegExp => {
  const hasTrailingGlobstar = TRAILING_GLOBSTAR.test(pattern)
  const body = hasTrailingGlobstar ? pattern.slice(0, -'/**'.length) : pattern
  const boundary = body.split('**/').map(convertGlobWildcards).join('(?:.*/)?')
  const suffix = hasTrailingGlobstar ? '(?:/.*)?' : ''
  return new RegExp(`^${boundary}${suffix}$`)
}

export const negationsOf = (mutate: readonly string[]): readonly RegExp[] =>
  mutate
    .filter(pattern => pattern.startsWith('!'))
    .map(pattern => globToRegExp(pattern.slice(1)))

export const applyNegations = (
  files: readonly string[],
  negations: readonly RegExp[]
): readonly string[] =>
  files.filter(file => !negations.some(negation => negation.test(file)))
