'use strict'
const COMMIT_REF_TYPE = 'commit'
const TAG_REF_TYPE = 'tag'
const IGNORE_WHITESPACE_PARAMS_FOR_FILE = [
  '--ignore-all-space',
  '--ignore-blank-lines',
  '--ignore-cr-at-eol',
]
module.exports.ADDITION = 'A'
module.exports.DELETION = 'D'
module.exports.MODIFICATION = 'M'
module.exports.COMMIT_REF_TYPE = COMMIT_REF_TYPE
module.exports.TAG_REF_TYPE = TAG_REF_TYPE
module.exports.POINTER_REF_TYPES = [COMMIT_REF_TYPE, TAG_REF_TYPE]
module.exports.GIT_DIFF_TYPE_REGEX = /^.\s+/u
module.exports.GIT_FOLDER = '.git'
module.exports.MINUS = '-'
module.exports.IGNORE_WHITESPACE_PARAMS_FOR_FILE =
  IGNORE_WHITESPACE_PARAMS_FOR_FILE
module.exports.IGNORE_WHITESPACE_PARAMS_FOR_REPO = [
  ...IGNORE_WHITESPACE_PARAMS_FOR_FILE,
  '--word-diff-regex=|[^[:space:]]',
]
module.exports.PLUS = '+'
module.exports.UTF8_ENCODING = 'utf8'
