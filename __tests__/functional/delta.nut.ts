'use strict'
import fs from 'node:fs'
import readline from 'readline'

import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'

describe('sgd source delta NUTS', () => {
  it('run help', () => {
    const result = execCmd('sgd source delta --help', {
      ensureExitCode: 0,
    }).shellOutput
    expect(result).to.include('incremental')
  })

  it('run `e2e` tests', async () => {
    // Act
    const result = execCmd(
      'sgd source delta --from "origin/e2e/base" --to "origin/e2e/head" --output e2e/expected --generate-delta --repo e2e --include e2e/.sgdinclude --include-destructive e2e/.sgdincludeDestructive --ignore e2e/.sgdignore --ignore-destructive e2e/.sgdignoreDestructive --json',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Assert
    const packageLineCount = await getFileLineNumber(
      'e2e/expected/package/package.xml'
    )
    const destructiveChangesLineCount = await getFileLineNumber(
      'e2e/expected/destructiveChanges/destructiveChanges.xml'
    )
    expect(packageLineCount).to.equal(232)
    expect(destructiveChangesLineCount).to.equal(137)
    expect(result).to.include('"status": 0')
  })
})

const getFileLineNumber = async (path: string) => {
  let linesCount = 0
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    output: process.stdout,
    terminal: false,
  })
  for await (const _ of rl) {
    ++linesCount
  }
  return linesCount
}
