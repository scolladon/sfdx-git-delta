'use strict'
const repoSetup = require('../../../../lib/utils/repoSetup')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

describe(`test if repoSetup`, () => {
  test('can set config.from if not defined', async () => {
    const config = { repo: '.' }
    mySpawn.setDefault(mySpawn.simple(0, ''))
    repoSetup(config)
    expect(config.from).not.toBeUndefined()
  })
  test('can set core.quotepath to off', async () => {
    const config = { repo: '.', from: 'HEAD' }
    mySpawn.setDefault(mySpawn.simple(0, ''))
    repoSetup(config)
    expect(config.from).not.toBeUndefined()
  })
})
