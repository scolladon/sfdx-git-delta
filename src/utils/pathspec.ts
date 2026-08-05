'use strict'
import { isAbsolute } from 'node:path/posix'

import { sanitizePath, treatPathSep } from './fsUtils.js'

declare const PATHSPEC_BRAND: unique symbol
export type Pathspec = string & { readonly [PATHSPEC_BRAND]: true }

export type SourceDirRejectionReason =
  | 'empty'
  | 'magic'
  | 'wildcard'
  | 'absolute'
  | 'escapes'

export type SourceDirRejection = Readonly<{
  value: string
  reason: SourceDirRejectionReason
}>

export type ParsedSourceDirs = Readonly<{
  pathspecs: Pathspec[]
  rejections: SourceDirRejection[]
}>

// Git pathspec magic prefix: ':(exclude)', ':!', ':(glob)', ':/', ':^' …
const MAGIC_PREFIX = ':'
const WILDCARD_CHARS_REGEX = /[*?[]/
// Windows drive letter followed by a separator, e.g. 'C:/x' or 'C:\x'.
// `path.posix.isAbsolute` does not flag these once treatPathSep has run.
const WINDOWS_DRIVE_REGEX = /^[A-Za-z]:[\\/]/
const TRAILING_SLASHES_REGEX = /\/+$/
const PATH_SEGMENT_SEP = '/'
const PARENT_SEGMENT = '..'
// normalize('.') === '.', normalize('./') === './', normalize('././') === './'
const ROOT_PATHSPECS = new Set(['.', './'])
const WHOLE_REPOSITORY = '.' as Pathspec

type CanonicalisationResult =
  | Readonly<{ ok: true; value: Pathspec }>
  | Readonly<{ ok: false; reason: SourceDirRejectionReason }>

const reject = (reason: SourceDirRejectionReason): CanonicalisationResult => ({
  ok: false,
  reason,
})

const accept = (value: string): CanonicalisationResult => ({
  ok: true,
  value: value as Pathspec,
})

// Steps 1-5 run on the raw value, before normalisation destroys the evidence
// they test for: a leading ':', a Windows drive letter, or a '..' segment
// all survive treatPathSep/normalize as an innocuous-looking literal —
// normalize('force-app/..') cancels straight down to '.', which is why the
// '..' check must see the segment before normalize resolves it away.
const hasParentSegment = (raw: string): boolean =>
  treatPathSep(raw).split(PATH_SEGMENT_SEP).includes(PARENT_SEGMENT)

const rejectRawValue = (raw: string): SourceDirRejectionReason | undefined => {
  if (raw === '') return 'empty'
  if (raw.startsWith(MAGIC_PREFIX)) return 'magic'
  if (WILDCARD_CHARS_REGEX.test(raw)) return 'wildcard'
  if (WINDOWS_DRIVE_REGEX.test(raw)) return 'absolute'
  if (hasParentSegment(raw)) return 'escapes'
  return undefined
}

const canonicalise = (raw: string): CanonicalisationResult => {
  const rawRejection = rejectRawValue(raw)
  if (rawRejection) return reject(rawRejection)

  const value = sanitizePath(raw)!
  if (isAbsolute(value)) return reject('absolute')
  if (ROOT_PATHSPECS.has(value)) return accept(WHOLE_REPOSITORY)

  return accept(value.replace(TRAILING_SLASHES_REGEX, ''))
}

export const parseSourceDirs = (raw: string[]): ParsedSourceDirs => {
  const pathspecs: Pathspec[] = []
  const rejections: SourceDirRejection[] = []
  const seen = new Set<string>()

  for (const value of raw) {
    const result = canonicalise(value)
    if (!result.ok) {
      rejections.push({ value, reason: result.reason })
      continue
    }
    if (seen.has(result.value)) continue
    seen.add(result.value)
    pathspecs.push(result.value)
  }

  return { pathspecs, rejections }
}
