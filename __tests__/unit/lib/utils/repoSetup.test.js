'use strict'
const RepoSetup = require('../../../../src/utils/repoSetup')
jest.mock('child_process')
const child_process = require('child_process')

describe(`test if repoSetup`, () => {
  test('say "to" equal "HEAD"', async () => {
    const config = { repo: '.', to: 'HEAD' }
    const repoSetup = new RepoSetup(config)
    const toEqualHead = await repoSetup.isToEqualHead()

    expect(toEqualHead).toBe(true)
  })

  test('say when "to" do not equals "HEAD"', async () => {
    const config = { repo: '.', to: 'not HEAD' }
    child_process.__setOutput([['not HEAD'], ['HEAD']])
    const repoSetup = new RepoSetup(config)
    const toEqualHead = await repoSetup.isToEqualHead()

    expect(toEqualHead).toBe(false)
  })

  test('can set core.quotepath to off', async () => {
    const config = { repo: '.', from: 'HEAD~1' }
    child_process.__setOutput([['']])
    const repoSetup = new RepoSetup(config)
    await repoSetup.repoConfiguration()
  })
})
