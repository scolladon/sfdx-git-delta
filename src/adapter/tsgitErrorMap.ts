'use strict'
import { getErrorMessage, RepositoryRefusalError } from '../utils/errorUtils.js'

// Raw tsgit surfaces this module narrows away from GitAdapter's
// user-surfacing methods: a bad ref/oid rejects with `TsgitError` whose
// message is prefixed `OBJECT_NOT_FOUND:`; a repository tsgit refuses to
// open at all rejects with one of the codes in REFUSAL_MESSAGES below.
// Neither raw shape is release-compatible.
const OBJECT_NOT_FOUND_CODE = 'OBJECT_NOT_FOUND'
const OBJECT_NOT_FOUND_PREFIX = `${OBJECT_NOT_FOUND_CODE}:`

const NOT_A_REPOSITORY_CODE = 'NOT_A_REPOSITORY'
const REPOSITORY_FORMAT_VERSION_UNSUPPORTED_CODE =
  'REPOSITORY_FORMAT_VERSION_UNSUPPORTED'
const REPOSITORY_EXTENSIONS_UNSUPPORTED_CODE =
  'REPOSITORY_EXTENSIONS_UNSUPPORTED'
const REPOSITORY_EXTENSION_UNSUPPORTED_CODE = 'REPOSITORY_EXTENSION_UNSUPPORTED'

type CodedError = { code?: unknown } | null | undefined

const codeOf = (error: unknown): unknown => (error as CodedError)?.code

const isObjectNotFound = (error: unknown, message: string): boolean =>
  codeOf(error) === OBJECT_NOT_FOUND_CODE ||
  message.startsWith(OBJECT_NOT_FOUND_PREFIX)

type TsgitDataError = { data?: { code?: unknown } } | null | undefined

const dataCodeOf = (error: unknown): unknown =>
  (error as TsgitDataError)?.data?.code

// tsgit renders every repository path down to its basename, so a mapped
// message has to be rebuilt from the path sgd itself opened. One sentence
// per condition, not per code: the three format refusals are not separately
// actionable — the user's move is the same for all three.
const notARepository = (repoPath: string) =>
  `'${repoPath}' is not a git repository`
const unreadableFormat = (repoPath: string) =>
  `'${repoPath}' uses a repository format this version of sgd cannot read`

const REFUSAL_MESSAGES: ReadonlyMap<string, (repoPath: string) => string> =
  new Map([
    [NOT_A_REPOSITORY_CODE, notARepository],
    [REPOSITORY_FORMAT_VERSION_UNSUPPORTED_CODE, unreadableFormat],
    [REPOSITORY_EXTENSIONS_UNSUPPORTED_CODE, unreadableFormat],
    [REPOSITORY_EXTENSION_UNSUPPORTED_CODE, unreadableFormat],
  ])

const refusalMessageFor = (
  error: unknown,
  message: string
): ((repoPath: string) => string) | undefined => {
  for (const [code, render] of REFUSAL_MESSAGES) {
    if (dataCodeOf(error) === code || message.startsWith(`${code}:`)) {
      return render
    }
  }
  return undefined
}

/**
 * Normalizes a raw tsgit rejection into a release-compatible Error. Pure —
 * no I/O, never throws itself, always returns an Error for the caller to
 * rethrow. `context` identifies the operation (a ref, an oid, a range) and
 * is interpolated into object-lookup messages; `repoPath` identifies the
 * repository and is interpolated into repository-refusal messages instead,
 * since tsgit renders those down to a bare basename.
 */
export const mapTsgitError = (
  error: unknown,
  context: string,
  repoPath: string
): Error => {
  const message = getErrorMessage(error)
  if (isObjectNotFound(error, message)) {
    return new Error(`${context}: not a valid git revision`)
  }
  const renderRefusal = refusalMessageFor(error, message)
  if (renderRefusal) {
    return new RepositoryRefusalError(renderRefusal(repoPath))
  }
  return new Error(`git operation failed: ${message}`)
}
