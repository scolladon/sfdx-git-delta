'use strict'
export const ADDITION = 'A'
export const BLOB_TYPE = 'blob'
export const DELETION = 'D'
export const GIT_DIFF_TYPE_REGEX = /^.\s+/u
export const GIT_FOLDER = '.git'
export const IGNORE_WHITESPACE_PARAMS = [
  '--ignore-all-space',
  '--ignore-blank-lines',
  '--ignore-cr-at-eol',
  '--word-diff-regex',
  '--word-diff-regex=|[^[:space:]]',
]
export const MODIFICATION = 'M'
export const NUM_STAT_CHANGE_INFORMATION = /^((\d+|\-)\t){2}/
export const TREE_TYPE = 'tree'
