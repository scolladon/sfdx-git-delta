'use strict'
const { spawn } = require('child_process')
const { linify } = require('./childProcessUtils')
const { gitPathSeparatorNormalizer } = require('./fsHelper')
const {
  IGNORE_WHITESPACE_PARAMS_FOR_FILE,
  UTF8_ENCODING,
} = require('./gitConstants')

const unitDiffParams = ['--no-pager', 'diff', '--no-prefix', '-U200']

module.exports = (filePath, config) => {
  const ignoreWhitespaceParams = config.ignoreWhitespace
    ? IGNORE_WHITESPACE_PARAMS_FOR_FILE
    : []
  const gitDiff = spawn(
    'git',
    [
      ...unitDiffParams,
      ...ignoreWhitespaceParams,
      config.from,
      config.to,
      '--',
      gitPathSeparatorNormalizer(filePath),
    ],
    { cwd: config.repo, encoding: UTF8_ENCODING }
  )

  return linify(gitDiff.stdout)
}
