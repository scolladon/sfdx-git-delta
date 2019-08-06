'use strict'
const path = require('path')
const cp = require('child_process')
const { exec } = cp

const cli = (args, cwd) => {
  return new Promise(resolve => {
    exec(
      `node ${path.normalize('./bin/cli')} ${args.join(' ')}`,
      { cwd },
      (error, stdout, stderr) => {
        resolve({
          code: error && error.code ? error.code : 0,
          error,
          stderr,
          stdout,
        })
      }
    )
  })
}

test('cli-help', async () => {
  const result = await cli(['-h'], '.')

  expect(result.code).toBe(0)
})
