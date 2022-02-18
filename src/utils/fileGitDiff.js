'use strict'
const childProcess = require('child_process')
const { linify } = require('./childProcessUtils')
const { IGNORE_WHITESPACE_PARAMS, UTF8_ENCODING } = require('./gitConstants')

const unitDiffParams = ['--no-pager', 'diff', '--no-prefix', '-U200']

module.exports = (filePath, config) => {
  const ignoreWhitespaceParams = config.ignoreWhitespace
    ? IGNORE_WHITESPACE_PARAMS
    : []
  const gitDiff = childProcess.spawn(
    'git',
    [
      ...unitDiffParams,
      ...ignoreWhitespaceParams,
      config.from,
      config.to,
      '--',
      filePath,
    ],
    { cwd: config.repo, encoding: UTF8_ENCODING, maxBuffer: 1024 * 10240 }
  )

  return linify(gitDiff.stdout)
}
