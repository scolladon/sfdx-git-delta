'use strict'
const { execCmd } = require('@salesforce/cli-plugins-testkit')
const { expect } = require('@salesforce/command/lib/test')

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
})
