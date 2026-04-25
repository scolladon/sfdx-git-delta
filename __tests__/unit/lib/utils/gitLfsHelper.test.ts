'use strict'
import { describe, expect, it } from 'vitest'

import {
  getLFSObjectContentPath,
  isLFS,
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
    const lfsFileContent = Buffer.from(`not lfs file`)

    // Act & Assert
    expect(() => getLFSObjectContentPath(lfsFileContent)).toThrow()
  })

  it('Given a traversal-crafted oid, When getLFSObjectContentPath runs, Then it rejects the oid as invalid', () => {
    // Arrange
    const malicious = Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256:../../../etc/passwd\nsize 7`
    )

    // Act & Assert
    expect(() => getLFSObjectContentPath(malicious)).toThrow('Invalid LFS oid')
  })

  it('Given an uppercase or short oid, When getLFSObjectContentPath runs, Then it rejects the oid as invalid', () => {
    // Arrange
    const tooShort = Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256:abc123\nsize 3`
    )
    const upper = Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256:${'A'.repeat(64)}\nsize 9`
    )

    // Act & Assert
    expect(() => getLFSObjectContentPath(tooShort)).toThrow()
    expect(() => getLFSObjectContentPath(upper)).toThrow()
  })

  it('Given exactly 64 lowercase hex chars, When getLFSObjectContentPath runs, Then succeeds (boundary: regex must be anchored)', () => {
    // Arrange — exactly 64 [a-f0-9] chars. If the regex were /^[a-f0-9]{64}/
    // without $ it would accept 65+ chars too; anchoring with $ is the
    // mutation survivor. This test forces the pattern to be tested at the
    // exact lower boundary.
    const oid = 'a'.repeat(64)
    const validContent = Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize 0`
    )

    // Act & Assert — must NOT throw for exactly 64 hex chars
    expect(() => getLFSObjectContentPath(validContent)).not.toThrow()
  })

  it('Given 65 lowercase hex chars, When getLFSObjectContentPath runs, Then rejects (regex anchored to exactly 64)', () => {
    // Arrange — 65-char oid must be rejected by /^[a-f0-9]{64}$/ but would
    // pass an unanchored /^[a-f0-9]{64}/ — this kills the $ mutation.
    const oid = 'a'.repeat(65)
    const tooLong = Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize 0`
    )

    // Act & Assert
    expect(() => getLFSObjectContentPath(tooLong)).toThrow('Invalid LFS oid')
  })

  it('Given content with only one line (no oid line), When getLFSObjectContentPath runs, Then optional chaining returns empty string and throws', () => {
    // Arrange — content has only the version line; split(/\n/)[1] is undefined.
    // Without the optional chaining (?.) on [1], this would throw a TypeError
    // before reaching the pattern test. With it, oid defaults to '' which
    // fails the pattern and throws the expected 'Invalid LFS oid' error.
    const oneLineBuf = Buffer.from(`version https://git-lfs.github.com/spec/v1`)

    // Act & Assert
    expect(() => getLFSObjectContentPath(oneLineBuf)).toThrow('Invalid LFS oid')
  })

  it('Given content where oid line has no colon, When getLFSObjectContentPath runs, Then split returns undefined and fallback empty string is used', () => {
    // Arrange — second line exists but contains no ':'. split(':')[1] is
    // undefined; the `?? ''` fallback (L19 StringLiteral) provides ''.
    const noColon = Buffer.from(
      `version https://git-lfs.github.com/spec/v1\noid sha256_no_colon\nsize 0`
    )

    // Act & Assert — '' does not match the regex, so 'Invalid LFS oid' is thrown
    expect(() => getLFSObjectContentPath(noColon)).toThrow('Invalid LFS oid')
  })
})
