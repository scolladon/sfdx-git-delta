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
})
