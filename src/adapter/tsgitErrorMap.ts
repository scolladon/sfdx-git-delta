'use strict'
import { getErrorMessage } from '../utils/errorUtils.js'

// Raw tsgit surfaces this module narrows away from GitAdapter's
// user-surfacing methods: `openRepository` rejects with a plain Node
// ENOENT whose message names `realpath` when the repo directory is
// missing; a bad ref/oid rejects with `TsgitError` whose message is
// prefixed `OBJECT_NOT_FOUND:`. Neither raw shape is release-compatible.
const ENOENT_CODE = 'ENOENT'
const REALPATH_HINT = 'realpath'
const OBJECT_NOT_FOUND_CODE = 'OBJECT_NOT_FOUND'
const OBJECT_NOT_FOUND_PREFIX = `${OBJECT_NOT_FOUND_CODE}:`

type CodedError = { code?: unknown } | null | undefined

const codeOf = (error: unknown): unknown => (error as CodedError)?.code

const isMissingRepo = (error: unknown, message: string): boolean =>
  codeOf(error) === ENOENT_CODE && message.includes(REALPATH_HINT)

const isObjectNotFound = (error: unknown, message: string): boolean =>
  codeOf(error) === OBJECT_NOT_FOUND_CODE ||
  message.startsWith(OBJECT_NOT_FOUND_PREFIX)

/**
 * Normalizes a raw tsgit rejection into a release-compatible Error. Pure —
 * no I/O, never throws itself, always returns an Error for the caller to
 * rethrow. `context` identifies the operation (a ref, an oid, a repo path)
 * and is interpolated into the mapped message.
 */
export const mapTsgitError = (error: unknown, context: string): Error => {
  const message = getErrorMessage(error)
  if (isMissingRepo(error, message)) {
    return new Error(`'${context}' is not a git repository`)
  }
  if (isObjectNotFound(error, message)) {
    return new Error(`${context}: not a valid git revision`)
  }
  return new Error(`git operation failed: ${message}`)
}
