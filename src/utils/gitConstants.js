'use strict'
const COMMIT_REF_TYPE = 'commit'
const TAG_REF_TYPE = 'tag'
module.exports.ADDITION = 'A'
module.exports.DELETION = 'D'
module.exports.MODIFICATION = 'M'
module.exports.COMMIT_REF_TYPE = COMMIT_REF_TYPE
module.exports.TAG_REF_TYPE = TAG_REF_TYPE
module.exports.POINTER_REF_TYPES = [COMMIT_REF_TYPE, TAG_REF_TYPE]
module.exports.GIT_DIFF_TYPE_REGEX = /^.\s+/u
module.exports.GIT_FOLDER = '.git'
module.exports.GIT_PATH_SEP = '/'
module.exports.IGNORE_WHITESPACE_PARAMS = [
  '--ignore-all-space',
  '--ignore-blank-lines',
  '--ignore-cr-at-eol',
  '--word-diff-regex=|[^[:space:]]',
]
module.exports.UTF8_ENCODING = 'utf8'
module.exports.GIT_COMMAND = 'git'
