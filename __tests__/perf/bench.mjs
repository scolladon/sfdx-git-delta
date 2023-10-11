'use strict'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import benchmark from 'benchmark'
const suite = new benchmark.Suite()

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
    // eslint-disable-next-line no-console
    console.log(String(event.target))
  })
  .run()
