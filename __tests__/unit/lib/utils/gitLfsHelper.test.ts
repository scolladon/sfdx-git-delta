'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getWork } from '../../../__utils__/globalTestHelper'
import { isLFS, copyLFS } from '../../../../src/utils/gitLfsHelper'
import { copy } from 'fs-extra'
import { Work } from '../../../../src/types/work'

jest.mock('fs-extra')

let work: Work
beforeEach(() => {
  jest.resetAllMocks()
  work = getWork()
})

describe('isLFS', () => {
  it('returns true when called with LFS file', async () => {
    // Arrange
    const lfsFileContent = `version https://git-lfs.github.com/spec/v1
    oid sha256:0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14
    size 72`

    // Act
    const result = isLFS(lfsFileContent)

    // Assert
    expect(result).toBe(true)
  })
  it('returns false when called with normal file', async () => {
    // Arrange
    const lfsFileContent = `not lfs file`

    // Act
    const result = isLFS(lfsFileContent)

    // Assert
    expect(result).toBe(false)
  })
})

describe('copyLFS', () => {
  it('should create src and copy it to dst', async () => {
    // Arrange
    const lfsFileContent = `version https://git-lfs.github.com/spec/v1
    oid sha256:0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14
    size 72`

    // Act
    await copyLFS(work.config, 'dst/file', lfsFileContent)

    // Assert
    expect(copy).toBeCalledWith(
      '.git/lfs/objects/0a/4c/0a4ca7e5eca75024197fff96ef7e5de1b2ca35d6c058ce76e7e0d84bee1c8b14',
      'dst/file'
    )
  })
})
