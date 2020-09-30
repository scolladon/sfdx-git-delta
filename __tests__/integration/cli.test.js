'use strict'
const path = require('path')
const cp = require('child_process')
const gc = require('../../src/utils/gitConstants')

const cli = (args, cwd) => {
  return cp.execSync(`node ${path.normalize('./bin/cli')} ${args.join(' ')}`, {
    cwd,
    encoding: gc.UTF8_ENCODING,
  })
}

test('cli-help', () => {
  const result = cli(['-h'], '.')
  expect(result).toBeDefined()
})
