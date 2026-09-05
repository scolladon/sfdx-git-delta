import { type DiffChange, toSimilarityPercent } from '@scolladon/tsgit'

import { TAB } from '../constant/cliConstants.js'
import { PATH_SEP } from '../constant/fsConstants.js'
import {
  ADDITION,
  DELETION,
  MODIFICATION,
  RENAMED,
} from '../constant/gitConstants.js'
import { treatPathSep } from '../utils/fsUtils.js'
import type { Pathspec } from '../utils/pathspec.js'

export const ROOT_PATHS = new Set(['', '.', './'])

const GITLINK_MODE = '160000'

type ScopeIndex = {
  readonly hasRoot: boolean
  readonly paths: ReadonlySet<string>
}

// Callers that check many paths against the same scopes (buildTreeIndex's
// per-revision walk, a grep matcher applied over every blob) pass the same
// `scopes` array reference on every call. Keying the index by that reference
// turns "build the scope set once" into a cache hit instead of a parameter
// threading exercise, so `inScope` keeps its existing shape.
const scopeIndexCache = new WeakMap<readonly string[], ScopeIndex>()

const indexScopes = (scopes: readonly string[]): ScopeIndex => {
  const cached = scopeIndexCache.get(scopes)
  if (cached) return cached

  const index: ScopeIndex = {
    hasRoot: scopes.some(scope => ROOT_PATHS.has(scope)),
    paths: new Set(scopes),
  }
  scopeIndexCache.set(scopes, index)
  return index
}

// A path is in scope when it equals a scope, or descends from one — i.e. any
// ancestor-directory prefix of the path is itself a scope. Walking the
// path's own prefixes against a Set is O(depth) per path regardless of scope
// count, replacing the former O(scopes) scan. Slicing at each separator
// (rather than a naive `startsWith(scope + '/')` scan) is what keeps a
// sibling like `lwc/foobar` from matching scope `lwc/foo`.
export const inScope = (path: string, scopes: readonly string[]): boolean => {
  const { hasRoot, paths } = indexScopes(scopes)
  if (hasRoot) return true

  let separatorIndex = path.indexOf(PATH_SEP)
  while (separatorIndex !== -1) {
    if (paths.has(path.slice(0, separatorIndex))) return true
    separatorIndex = path.indexOf(PATH_SEP, separatorIndex + 1)
  }
  return paths.has(path)
}

const keepSide = (
  mode: string,
  path: string,
  scopes: readonly string[]
): boolean =>
  mode !== GITLINK_MODE && (scopes.length === 0 || inScope(path, scopes))

export const hasRootScope = (scopes: readonly Pathspec[]): boolean =>
  scopes.some(scope => ROOT_PATHS.has(scope))

export const nonRootScopes = (scopes: readonly Pathspec[]): Pathspec[] =>
  scopes.filter(scope => !ROOT_PATHS.has(scope))

// git prints rename similarity as a zero-padded three-digit percent (R087).
const similarityPercent = (similarity: { score: number }): string =>
  String(toSimilarityPercent(similarity.score)).padStart(3, '0')

// The facade diff takes no pathspec, so `-- <source>` scoping is replicated
// per side. Gitlink changes are skipped (submodule pointer moves are not
// deployable metadata) and `type-change`/`copy` entries are dropped for
// parity with the subprocess `--diff-filter=AMD(R)`. A rename with only one
// side in scope degrades to that side's A/D line, matching what the
// subprocess pathspec does to a broken rename pair.
export function* toDiffLines(
  change: DiffChange,
  scopes: readonly string[]
): Generator<string> {
  switch (change.type) {
    case 'add':
      if (keepSide(change.newMode, change.newPath, scopes)) {
        yield `${ADDITION}${TAB}${treatPathSep(change.newPath)}`
      }
      break
    case 'delete':
      if (keepSide(change.oldMode, change.oldPath, scopes)) {
        yield `${DELETION}${TAB}${treatPathSep(change.oldPath)}`
      }
      break
    case 'modify':
      if (
        change.oldMode !== GITLINK_MODE &&
        keepSide(change.newMode, change.path, scopes)
      ) {
        yield `${MODIFICATION}${TAB}${treatPathSep(change.path)}`
      }
      break
    case 'rename': {
      const oldKept = keepSide(change.oldMode, change.oldPath, scopes)
      const newKept = keepSide(change.newMode, change.newPath, scopes)
      if (oldKept && newKept) {
        yield `${RENAMED}${similarityPercent(change.similarity)}${TAB}${treatPathSep(change.oldPath)}${TAB}${treatPathSep(change.newPath)}`
      } else if (newKept) {
        yield `${ADDITION}${TAB}${treatPathSep(change.newPath)}`
      } else if (oldKept) {
        yield `${DELETION}${TAB}${treatPathSep(change.oldPath)}`
      }
      break
    }
  }
}

const GLOB_CHARS = /[*?[]/
const REGEXP_SPECIALS = /[.+^${}()|\\\]]/g

// Concrete repository paths are matched by directory prefix only — no
// wildmatch, no leading-prefix normalisation. A path off the repository can
// never carry a leading './' or '/' (treatPathSep and basePath already rule
// those out), and treating `[` as a glob-class opener would misread real
// path segments like an object folder named `Custom[1]__c`.
export const buildLiteralMatcher =
  (specs: string[]) =>
  (path: string): boolean =>
    inScope(path, specs)

// Git pathspec semantics: a literal pathspec matches by directory prefix; a
// pathspec containing wildcards uses wildmatch where `*` also crosses `/`
// (no `:(glob)` magic). Callers mix both shapes (e.g. flow translations use
// `<source>/*.translation-meta.xml`).
export const buildPathspecMatcher = (
  specs: string[]
): ((path: string) => boolean) => {
  // Git normalizes leading `./` (and the `.//*` shape produced by the
  // default `./` source dir) away before matching; repo paths never carry
  // either prefix.
  const normalized = specs.map(spec =>
    spec.replace(/^(\.\/)+/, '').replace(/^\/+/, '')
  )
  const literals = normalized.filter(spec => !GLOB_CHARS.test(spec))
  const globs = normalized
    .filter(spec => GLOB_CHARS.test(spec))
    .map(spec => {
      const escaped = spec
        .replace(REGEXP_SPECIALS, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
      return new RegExp(`^${escaped}$`)
    })
  return (path: string): boolean =>
    (literals.length > 0 && inScope(path, literals)) ||
    globs.some(glob => glob.test(path))
}
