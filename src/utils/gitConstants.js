'use strict'
module.exports.ADDITION = 'A'
module.exports.DELETION = 'D'
module.exports.MODIFICATION = 'M'
module.exports.COMMIT_REF_TYPE = 'commit'
module.exports.GIT_DIFF_TYPE_REGEX = /^.\s+/u
module.exports.GIT_FOLDER = '.git'
module.exports.MINUS = '-'
module.exports.IGNORE_WHITESPACE_PARAMS = [
  '--ignore-all-space',
  '--ignore-blank-lines',
  '--ignore-cr-at-eol',
  '--word-diff-regex=|[^[:space:]]',
]
module.exports.PLUS = '+'
module.exports.UTF8_ENCODING = 'utf8'
