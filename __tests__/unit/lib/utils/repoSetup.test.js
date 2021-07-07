'use strict'
const RepoSetup = require('../../../../src/utils/repoSetup')
const gc = require('../../../../src/utils/gitConstants')
const child_process = require('child_process')
jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs-extra')
jest.mock('fs')

describe(`test if repoSetup`, () => {
  test('say "to" equal "HEAD"', () => {
    const config = { repo: '.', to: 'HEAD' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    const toEqualHead = repoSetup.isToEqualHead()

    expect(toEqualHead).toBe(true)
    expect(child_process.spawnSync).not.toHaveBeenCalled()
  })

  test('say when "to" do not equals "HEAD"', () => {
    const config = { repo: '.', to: 'not HEAD' }
    child_process.spawnSync
      .mockReturnValueOnce({ stdout: Buffer.from('HEAD', gc.UTF8_ENCODING) })
      .mockReturnValueOnce({
        stdout: Buffer.from('not HEAD', gc.UTF8_ENCODING),
      })
    const repoSetup = new RepoSetup(config)
    const toEqualHead = repoSetup.isToEqualHead()

    expect(toEqualHead).toBe(false)
    expect(child_process.spawnSync).toHaveBeenCalled()
  })

  test('can set config.from if not defined', () => {
    const config = { repo: '.' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    const firsSha = repoSetup.computeFromRef()

    expect(firsSha).not.toBeUndefined()
    expect(child_process.spawnSync).toHaveBeenCalled()
  })

  test('can set config.from if defined', () => {
    const config = { repo: '.', from: 'HEAD~1' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    const firsSha = repoSetup.computeFromRef()

    expect(firsSha).not.toBeUndefined()
    expect(child_process.spawnSync).not.toHaveBeenCalled()
  })

  test('can set core.quotepath to off', () => {
    const config = { repo: '.', from: 'HEAD~1' }
    child_process.spawnSync.mockImplementation(() => ({
      stdout: '',
    }))
    const repoSetup = new RepoSetup(config)
    repoSetup.repoConfiguration()
    expect(child_process.spawnSync).toHaveBeenCalled()
  })
})
