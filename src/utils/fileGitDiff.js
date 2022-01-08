'use strict'
const childProcess = require('child_process')
const cpUtils = require('./childProcessUtils')
const gc = require('./gitConstants')

const unitDiffParams = ['--no-pager', 'diff', '--no-prefix', '-U200']

module.exports = async (filePath, config) => {
  const ignoreWhitespaceParams = config.ignoreWhitespace
    ? gc.IGNORE_WHITESPACE_PARAMS
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
    { cwd: config.repo, encoding: gc.UTF8_ENCODING, maxBuffer: 1024 * 10240 }
  )

  const lines = []
  for await (const line of cpUtils.linify(gitDiff.stdout)) {
    lines.push(line)
  }

  return lines
}
