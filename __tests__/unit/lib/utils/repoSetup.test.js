'use strict'
const repoSetup = require('../../../../lib/utils/repoSetup')
const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')

describe(`test if repoSetup`, () => {
  test('can set config.from if not defined', () => {
    const config = { repo: '.' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    repoSetup(config)
    expect(config.from).not.toBeUndefined()
  })
  test('can set core.quotepath to off', () => {
    const config = { repo: '.', from: 'HEAD' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    repoSetup(config)
    expect(config.from).not.toBeUndefined()
  })
})
