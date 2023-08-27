'use strict'
const { execCmd } = require('@salesforce/cli-plugins-testkit')
const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()

suite
  .add('e2e-test', () => {
    execCmd(
      'sgd:source:delta --from "origin/e2e/base" --to "origin/e2e/head" --output e2e/expected --generate-delta --repo e2e --include e2e/.sgdinclude --include-destructive e2e/.sgdincludeDestructive --ignore e2e/.sgdignore --ignore-destructive e2e/.sgdignoreDestructive',
      {
        ensureExitCode: 0,
      }
    )
  })
  .on('cycle', event => {
    console.log(String(event.target))
  })
  .run()
