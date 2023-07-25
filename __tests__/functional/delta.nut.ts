'use strict'
const { execCmd } = require('@salesforce/cli-plugins-testkit')
const { expect } = require('@salesforce/command/lib/test')
const readline = require('readline')
const fs = require('fs')

describe('sgd:source:delta NUTS', () => {
  it('run help', () => {
    const result = execCmd('sgd:source:delta --help', {
      ensureExitCode: 0,
    }).shellOutput
    expect(result).to.include('sgd:source:delta')
  })

  it('detects not existing output folder', () => {
    const result = execCmd('sgd:source:delta --from "HEAD"', {
      ensureExitCode: 1,
    }).shellOutput
    expect(result).to.include('folder does not exist')
    expect(result).to.include('"success": false')
  })

  it('detects not existing output folder with json outputs', () => {
    const result = execCmd('sgd:source:delta --from "HEAD" --json', {
      ensureExitCode: 1,
    }).shellOutput
    expect(result).to.include('folder does not exist')
    expect(result).to.include('"success": false')
  })

  it('outputs json', () => {
    const result = execCmd('sgd:source:delta --from "HEAD" -o reports', {
      ensureExitCode: 0,
    }).shellOutput
    expect(result).to.include('"error": null')
    expect(result).to.include('"success": true')
  })

  it('outputs json with `--json`', () => {
    const result = execCmd('sgd:source:delta --from "HEAD" -o reports --json', {
      ensureExitCode: 0,
    }).shellOutput
    expect(result).to.include('"error": null')
    expect(result).to.include('"success": true')
  })

  it('run `e2e` tests', async () => {
    // Act
    const result = execCmd(
      'sgd:source:delta --from "origin/e2e/base" --to "origin/e2e/head" --output e2e/expected --generate-delta --repo e2e --ignore e2e/.sgdignore',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Assert
    const packageLineCount = await getFileLineNumber(
      'e2e/expected/package/package.xml'
    )
    expect(packageLineCount).to.equal(194)
    expect(result).to.include('"error": null')
    expect(result).to.include('"success": true')
  })
})

const getFileLineNumber = async path => {
  let linesCount = 0
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    output: process.stdout,
    terminal: false,
  })
  // eslint-disable-next-line no-unused-vars
  for await (const _ of rl) {
    ++linesCount
  }
  return linesCount
}
