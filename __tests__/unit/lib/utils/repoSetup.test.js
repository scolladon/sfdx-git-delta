'use strict'
const RepoSetup = require('../../../../src/utils/repoSetup')
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
    const repoSetup = new RepoSetup(config)
    const firsSha = repoSetup.getFirstSHA()

    expect(firsSha).not.toBeUndefined()
    expect(child_process.spawnSync).toHaveBeenCalled()
  })
  test('can set core.quotepath to off', () => {
    const config = { repo: '.', from: 'HEAD' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    repoSetup.repoConfiguration()
    expect(child_process.spawnSync).toHaveBeenCalled()
  })

  test('can checkout to', () => {
    const config = { repo: '.', from: 'HEAD' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    repoSetup.checkoutTo()
    expect(child_process.spawnSync).toHaveBeenCalled()
  })

  test('can checkout back', () => {
    const config = { repo: '.', from: 'HEAD' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    repoSetup.checkoutRef()
    expect(child_process.spawnSync).toHaveBeenCalled()
  })
})
