'use strict'
const path = require('path')
const cp = require('child_process')
const gc = require('../src/utils/gitConstants')

const cli = (args, cwd) => {
  return cp.execSync(`node ${path.normalize('./bin/run')} ${args.join(' ')}`, {
    cwd,
    encoding: gc.UTF8_ENCODING,
  })
}

test('run-help', () => {
  const result = cli(['-h'], '.')
  expect(result).toBeDefined()
})
