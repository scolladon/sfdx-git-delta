'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import RepoSetup from '../../../../src/utils/repoSetup'
import {
  getSpawnContent,
  getSpawnContentByLine,
} from '../../../../src/utils/childProcessUtils'
import { Config } from '../../../../src/types/config'
jest.mock('../../../../src/utils/childProcessUtils')

const mockedGetSpawContent = jest.mocked(getSpawnContent)
const mockedGetSpawContentByLine = jest.mocked(getSpawnContentByLine)

describe(`test if repoSetup`, () => {
  const config: Config = {
    to: '',
    from: '',
    output: '',
    source: '',
    ignore: '',
    ignoreDestructive: '',
    apiVersion: 0,
    repo: '',
    ignoreWhitespace: false,
    generateDelta: false,
    include: '',
    includeDestructive: '',
  }
  describe('repoConfiguration', () => {
    it('can set core.quotepath to off', async () => {
      config.repo = './'
      config.from = 'HEAD~1'
      mockedGetSpawContent.mockResolvedValue(Buffer.from(''))
      const repoSetup = new RepoSetup(config)
      await repoSetup.repoConfiguration()
      expect(mockedGetSpawContent).toBeCalledTimes(1)
    })
  })

  describe('getCommitRefType', () => {
    it('returns "commit" when commitRef is a commit', async () => {
      const shaRef = 'HEAD'
      config.repo = './'
      config.to = shaRef
      mockedGetSpawContent.mockResolvedValue(Buffer.from('commit'))
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getCommitRefType(shaRef)

      expect(commitRef).toBe('commit')
    })

    it('returns "tag" when commitRef is a tag', async () => {
      const shaRef = 'tag'
      config.repo = './'
      config.to = shaRef
      mockedGetSpawContent.mockResolvedValue(Buffer.from('tag'))
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getCommitRefType(shaRef)

      expect(commitRef).toBe('tag')
    })

    it('return empty string when commitRef is a not a git sha', async () => {
      const shaRef = 'wrong sha'
      config.repo = './'
      config.to = shaRef
      mockedGetSpawContent.mockResolvedValue(Buffer.from(''))
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getCommitRefType(shaRef)

      expect(commitRef).toBe('')
    })
  })

  describe('getFirstCommitRef', () => {
    it('returns the first commit SHA', async () => {
      // Arrange
      config.repo = './'
      mockedGetSpawContent.mockResolvedValue(Buffer.from('firstsha'))

      // Act
      const repoSetup = new RepoSetup(config)
      const commitRef = await repoSetup.getFirstCommitRef()

      // Assert

      expect(commitRef).toBe('firstsha')
    })
  })

  describe('getAllFilesAsLineStream', () => {
    it('returns all the file at <to> sha', async () => {
      // Arrange
      const expected = ['file/path/name.ext', 'other/file/path/name.ext']
      config.repo = './'
      mockedGetSpawContentByLine.mockResolvedValue(expected)

      // Act
      const repoSetup = new RepoSetup(config)
      const lines = await repoSetup.getAllFilesAsLineStream()

      // Assert
      expect(lines).toStrictEqual(expected)
    })
  })
})
