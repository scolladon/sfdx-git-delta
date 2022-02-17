'use strict'
const RepoSetup = require('../../../../src/utils/repoSetup')
const mockSpawn = require('mock-spawn')
const mySpawn = mockSpawn()
require('child_process').spawn = mySpawn

describe(`test if repoSetup`, () => {
  test('say "to" equal "HEAD"', async () => {
    const config = { repo: '.', to: 'HEAD' }
    const repoSetup = new RepoSetup(config)
    const toEqualHead = await repoSetup.isToEqualHead()

    expect(toEqualHead).toBe(true)
  })

  test('say when "to" do not equals "HEAD"', async () => {
    const config = { repo: '.', to: 'not HEAD' }
    mySpawn.sequence.add(mySpawn.simple(0, 'HEAD'))
    mySpawn.sequence.add(mySpawn.simple(0, 'not HEAD'))
    const repoSetup = new RepoSetup(config)
    const toEqualHead = await repoSetup.isToEqualHead()

    expect(toEqualHead).toBe(false)
  })

  test('can set config.from if not defined', async () => {
    const config = { repo: '.' }
    mySpawn.setDefault(mySpawn.simple(0, 'firstSha'))
    const repoSetup = new RepoSetup(config)
    const firsSha = await repoSetup.computeFromRef()

    expect(firsSha).not.toBeUndefined()
  })

  test('can set config.from if defined', async () => {
    const config = { repo: '.', from: 'HEAD~1' }
    mySpawn.setDefault(mySpawn.simple(0, 'firstSha'))
    const repoSetup = new RepoSetup(config)
    const firsSha = await repoSetup.computeFromRef()

    expect(firsSha).not.toBeUndefined()
  })

  test('can set core.quotepath to off', async () => {
    const config = { repo: '.', from: 'HEAD~1' }
    mySpawn.setDefault(mySpawn.simple(0, ''))
    const repoSetup = new RepoSetup(config)
    await repoSetup.repoConfiguration()
  })
})
