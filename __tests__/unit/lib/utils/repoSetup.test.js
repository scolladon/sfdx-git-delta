'use strict'
const RepoSetup = require('../../../../src/utils/repoSetup')
jest.mock('child_process')
const child_process = require('child_process')

describe(`test if repoSetup`, () => {
  describe('repoConfiguration', () => {
    test('can set core.quotepath to off', async () => {
      const config = { repo: './', from: 'HEAD~1' }
      child_process.__setOutput([['']])
      const repoSetup = new RepoSetup(config)
      await repoSetup.repoConfiguration()
      expect(child_process.spawn).toBeCalledTimes(1)
    })
  })

  describe('getCommitRefType', () => {
    test('returns "commit" when commitRef is a commit', async () => {
      const shaRef = 'HEAD'
      const config = { repo: './', to: shaRef }
      child_process.__setOutput([['commit']])
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getCommitRefType(shaRef)

      expect(commitRef).toBe('commit')
    })

    test('returns "tag" when commitRef is a tag', async () => {
      const shaRef = 'tag'
      const config = { repo: './', to: shaRef }
      child_process.__setOutput([['tag']])
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getCommitRefType(shaRef)

      expect(commitRef).toBe('tag')
    })

    test('return empty string when commitRef is a not a git sha', async () => {
      const shaRef = 'wrong sha'
      const config = { repo: './', to: shaRef }
      child_process.__setOutput([['']])
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getCommitRefType(shaRef)

      expect(commitRef).toBe('')
    })
  })

  describe('getFirstCommitRef', () => {
    test('returns the first commit SHA', async () => {
      // Arrange
      const config = { repo: './' }
      child_process.__setOutput([['firstsha']])

      // Act
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getFirstCommitRef()

      // Assert

      expect(commitRef).toBe('firstsha')
    })
  })
})
