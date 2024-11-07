'use strict'
export const ADDITION = 'A'
export const DELETION = 'D'
export const MODIFICATION = 'M'
export const GIT_DIFF_TYPE_REGEX = /^.\s+/u
export const GIT_FOLDER = '.git'
export const UTF8_ENCODING = 'utf8'
export const IGNORE_WHITESPACE_PARAMS = [
  '--ignore-all-space',
  '--ignore-blank-lines',
  '--ignore-cr-at-eol',
  '--word-diff-regex',
  '--word-diff-regex=|[^[:space:]]',
]
