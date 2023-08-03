'use strict'
export const ADDITION = 'A'
export const DELETION = 'D'
export const MODIFICATION = 'M'
export const COMMIT_REF_TYPE = 'commit'
export const TAG_REF_TYPE = 'tag'
export const POINTER_REF_TYPES = [COMMIT_REF_TYPE, TAG_REF_TYPE]
export const GIT_DIFF_TYPE_REGEX = /^.\s+/u
export const GIT_FOLDER = '.git'
export const GIT_PATH_SEP = '/'
export const IGNORE_WHITESPACE_PARAMS = [
  '--ignore-all-space',
  '--ignore-blank-lines',
  '--ignore-cr-at-eol',
  '--word-diff-regex=|[^[:space:]]',
]
export const UTF8_ENCODING = 'utf8'
export const GIT_COMMAND = 'git'
