'use strict'
import { expect, describe, it } from '@jest/globals'
import {
  EOLRegex,
  isLFS,
  getLFSObjectContentPath,
} from '../../../../src/utils/gitLfsHelper'

describe('isLFS', () => {
  it('returns true when called with LFS file', async () => {
    // Arrange
    const lfsFileContent =
      Buffer.from(`version https://git-lfs.github.com/spec/v1
    oid sha256:0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14
    size 72`)

    // Act
    const result = isLFS(lfsFileContent)

    // Assert
    expect(result).toBe(true)
  })
  it('returns false when called with normal file', async () => {
    // Arrange
    const lfsFileContent = Buffer.from(`not lfs file`)

    // Act
    const result = isLFS(lfsFileContent)

    // Assert
    expect(result).toBe(false)
  })
})

describe('getLFSObjectContentPath', () => {
  it('with LFS content, it creates LFS file path', async () => {
    // Arrange
    const lfsFileContent =
      Buffer.from(`version https://git-lfs.github.com/spec/v1
    oid sha256:0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14
    size 72`)

    // Act
    const lfsFilePath = await getLFSObjectContentPath(lfsFileContent)

    // Assert
    expect(lfsFilePath).toBe(
      '.git/lfs/objects/0a/4c/0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14'
    )
  })

  it('without LFS content, it creates LFS file path', async () => {
    // Arrange
    expect.assertions(1)
    const lfsFileContent = Buffer.from(`not lfs file`)

    // Act
    try {
      await getLFSObjectContentPath(lfsFileContent)
    } catch (e) {
      // Assert
      expect(e).toBeDefined()
    }
  })
})

describe('EOLRegex', () => {
  it('matches CR LF', () => {
    // Arrange
    const input = 'test\r\ntest'

    // Act
    const matches = EOLRegex.test(input)

    // Assert
    expect(matches).toBe(true)
  })

  it('matches LF', () => {
    // Arrange
    const input = 'testtest\n'

    // Act
    const matches = EOLRegex.test(input)

    // Assert
    expect(matches).toBe(true)
  })

  it('does not matches CR only', () => {
    // Arrange
    const input = 'test\rtest'

    // Act
    const matches = EOLRegex.test(input)

    // Assert
    expect(matches).toBe(false)
  })

  it('does not matches any string ', () => {
    // Arrange
    const input = 'test,test'

    // Act
    const matches = EOLRegex.test(input)

    // Assert
    expect(matches).toBe(false)
  })
})
