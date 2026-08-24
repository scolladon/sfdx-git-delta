'use strict'
import { describe, expect, it } from 'vitest'

import { mapTsgitError } from '../../../../src/adapter/tsgitErrorMap'
import { RepositoryRefusalError } from '../../../../src/utils/errorUtils'

const enoentRealpath = Object.assign(
  new Error("ENOENT: no such file or directory, realpath '/missing/repo'"),
  { code: 'ENOENT' }
)

const enoentOther = Object.assign(
  new Error("ENOENT: no such file or directory, open '/repo/some-file'"),
  { code: 'ENOENT' }
)

const objectNotFoundByDataCode = Object.assign(
  new Error('object not found: deadbeef'),
  { data: { code: 'OBJECT_NOT_FOUND' } }
)

const objectNotFoundByMessage = new Error(
  'OBJECT_NOT_FOUND: object not found: cafebabe'
)

const genericTsgitError = new Error('TsgitError: something else broke')

const notARepositoryByDataCode = Object.assign(
  new Error('not a git repository: my-repo'),
  { data: { code: 'NOT_A_REPOSITORY', path: '/tmp/my-repo' } }
)

const notARepositoryByPrefix = new Error(
  'NOT_A_REPOSITORY: not a git repository: my-repo'
)

const formatVersionUnsupportedByDataCode = Object.assign(
  new Error('unsupported repository format version: 99'),
  { data: { code: 'REPOSITORY_FORMAT_VERSION_UNSUPPORTED', version: 99 } }
)

const formatVersionUnsupportedByPrefix = new Error(
  'REPOSITORY_FORMAT_VERSION_UNSUPPORTED: unsupported repository format version: 99'
)

const extensionsUnsupportedByDataCode = Object.assign(
  new Error(
    'unsupported repository extensions at format version 1: 2 (first: objectformat)'
  ),
  {
    data: {
      code: 'REPOSITORY_EXTENSIONS_UNSUPPORTED',
      version: 1,
      extensions: ['objectformat', 'other'],
    },
  }
)

const extensionsUnsupportedByPrefix = new Error(
  'REPOSITORY_EXTENSIONS_UNSUPPORTED: unsupported repository extensions at format version 1: 2 (first: objectformat)'
)

const extensionUnsupportedByDataCode = Object.assign(
  new Error('repository extension not supported: objectformat = bogus-value'),
  {
    data: {
      code: 'REPOSITORY_EXTENSION_UNSUPPORTED',
      extension: 'objectformat',
      value: 'bogus-value',
    },
  }
)

const extensionUnsupportedByPrefix = new Error(
  'REPOSITORY_EXTENSION_UNSUPPORTED: repository extension not supported: objectformat = bogus-value'
)

const notARepositoryNearMiss = new Error('NOT_A_REPOSITORY_SOMETHING: invented')

const extensionUnsupportedNearMiss = new Error(
  'REPOSITORY_EXTENSION_UNSUPPORTED_EXTRA: invented'
)

const NOT_A_REPOSITORY_MESSAGE = "'/proj/my-repo' is not a git repository"
const UNREADABLE_FORMAT_MESSAGE =
  "'/proj/my-repo' uses a repository format this version of sgd cannot read"
const GENERIC_PREFIX = 'git operation failed: '

// The five raw shapes a rewriting arm must never let through to a mapped
// message, regardless of which arm did the rewriting.
const RAW_TSGIT_CODES = [
  'OBJECT_NOT_FOUND',
  'NOT_A_REPOSITORY',
  'REPOSITORY_FORMAT_VERSION_UNSUPPORTED',
  'REPOSITORY_EXTENSIONS_UNSUPPORTED',
  'REPOSITORY_EXTENSION_UNSUPPORTED',
]

const MAPPING_ROWS = [
  [
    'an ENOENT error naming realpath (the retired missing-repository arm)',
    enoentRealpath,
    '/missing/repo',
    '/repo',
    "git operation failed: ENOENT: no such file or directory, realpath '/missing/repo'",
  ],
  [
    'an ENOENT error not naming realpath',
    enoentOther,
    'some-context',
    '/repo',
    "git operation failed: ENOENT: no such file or directory, open '/repo/some-file'",
  ],
  [
    'an OBJECT_NOT_FOUND error identified by data.code, message without the prefix',
    objectNotFoundByDataCode,
    'HEAD~999',
    '/repo',
    'HEAD~999: not a valid git revision',
  ],
  [
    'an OBJECT_NOT_FOUND error identified by message prefix only',
    objectNotFoundByMessage,
    'ref',
    '/repo',
    'ref: not a valid git revision',
  ],
  [
    'a generic Error with no recognized shape',
    genericTsgitError,
    'op',
    '/repo',
    'git operation failed: TsgitError: something else broke',
  ],
  [
    'a non-Error thrown value',
    'raw-string-failure',
    'op',
    '/repo',
    'git operation failed: raw-string-failure',
  ],
  ['a null thrown value', null, 'op', '/repo', 'git operation failed: null'],
  [
    'a NOT_A_REPOSITORY error identified by data.code, message without the prefix',
    notARepositoryByDataCode,
    'HEAD',
    '/proj/my-repo',
    NOT_A_REPOSITORY_MESSAGE,
  ],
  [
    'a NOT_A_REPOSITORY error identified by message prefix, no data',
    notARepositoryByPrefix,
    'HEAD',
    '/proj/my-repo',
    NOT_A_REPOSITORY_MESSAGE,
  ],
  [
    'a REPOSITORY_FORMAT_VERSION_UNSUPPORTED error identified by data.code, message without the prefix',
    formatVersionUnsupportedByDataCode,
    'HEAD',
    '/proj/my-repo',
    UNREADABLE_FORMAT_MESSAGE,
  ],
  [
    'a REPOSITORY_FORMAT_VERSION_UNSUPPORTED error identified by message prefix, no data',
    formatVersionUnsupportedByPrefix,
    'HEAD',
    '/proj/my-repo',
    UNREADABLE_FORMAT_MESSAGE,
  ],
  [
    'a REPOSITORY_EXTENSIONS_UNSUPPORTED error identified by data.code, message without the prefix',
    extensionsUnsupportedByDataCode,
    'HEAD',
    '/proj/my-repo',
    UNREADABLE_FORMAT_MESSAGE,
  ],
  [
    'a REPOSITORY_EXTENSIONS_UNSUPPORTED error identified by message prefix, no data',
    extensionsUnsupportedByPrefix,
    'HEAD',
    '/proj/my-repo',
    UNREADABLE_FORMAT_MESSAGE,
  ],
  [
    'a REPOSITORY_EXTENSION_UNSUPPORTED error identified by data.code, message without the prefix',
    extensionUnsupportedByDataCode,
    'HEAD',
    '/proj/my-repo',
    UNREADABLE_FORMAT_MESSAGE,
  ],
  [
    'a REPOSITORY_EXTENSION_UNSUPPORTED error identified by message prefix, no data',
    extensionUnsupportedByPrefix,
    'HEAD',
    '/proj/my-repo',
    UNREADABLE_FORMAT_MESSAGE,
  ],
  [
    'a message merely starting with a refusal code without the colon boundary',
    notARepositoryNearMiss,
    'op',
    '/repo',
    `${GENERIC_PREFIX}NOT_A_REPOSITORY_SOMETHING: invented`,
  ],
  [
    'a message with trailing characters after the singular extension code',
    extensionUnsupportedNearMiss,
    'op',
    '/repo',
    `${GENERIC_PREFIX}REPOSITORY_EXTENSION_UNSUPPORTED_EXTRA: invented`,
  ],
] as const

// The generic arm's whole job is to pass the engine's message through, so
// only the rewriting arms can be held to "no raw shape reaches the user".
const REWRITTEN_ROWS = MAPPING_ROWS.filter(
  ([, , , , expected]) => !expected.startsWith(GENERIC_PREFIX)
)

describe('Given mapTsgitError', () => {
  it.each(MAPPING_ROWS)(
    'When mapping %s, Then it returns the mapped message',
    (_description, error, context, repoPath, expected) => {
      // Arrange
      const sut = mapTsgitError

      // Act
      const result = sut(error, context, repoPath)

      // Assert
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe(expected)
    }
  )

  it.each(REWRITTEN_ROWS)(
    'When mapping %s, Then the mapped message never leaks a raw tsgit shape',
    (_description, error, context, repoPath) => {
      // Arrange
      const sut = mapTsgitError

      // Act
      const result = sut(error, context, repoPath)

      // Assert
      expect(result.message).not.toContain('TsgitError')
      for (const code of RAW_TSGIT_CODES) {
        expect(result.message).not.toContain(code)
      }
    }
  )

  it('When mapping a repository refusal, Then it returns a RepositoryRefusalError', () => {
    // Arrange
    const sut = mapTsgitError

    // Act
    const result = sut(notARepositoryByPrefix, 'HEAD', '/proj/my-repo')

    // Assert — the name rides along into stack traces and serialized
    // output, where `instanceof` cannot reach.
    expect(result).toBeInstanceOf(RepositoryRefusalError)
    expect(result.name).toBe('RepositoryRefusalError')
  })

  it('When mapping any other failure, Then it returns a plain Error', () => {
    // Arrange
    const sut = mapTsgitError

    // Act
    const objectNotFoundResult = sut(
      objectNotFoundByDataCode,
      'HEAD~999',
      '/repo'
    )
    const genericResult = sut(genericTsgitError, 'op', '/repo')

    // Assert
    expect(objectNotFoundResult).toBeInstanceOf(Error)
    expect(objectNotFoundResult).not.toBeInstanceOf(RepositoryRefusalError)
    expect(genericResult).toBeInstanceOf(Error)
    expect(genericResult).not.toBeInstanceOf(RepositoryRefusalError)
  })

  describe('Given a repository path carrying injectable characters', () => {
    const injectedPath = 'a\nERROR: deployment approved\nb'

    it('When mapping a not-a-repository refusal, Then the repository path is sanitized in the mapped message', () => {
      // Arrange
      const sut = mapTsgitError

      // Act
      const result = sut(notARepositoryByPrefix, 'HEAD', injectedPath)

      // Assert
      expect(result.message).toBe(
        "'a\\u{a}ERROR: deployment approved\\u{a}b' is not a git repository"
      )
      expect(result.message.split('\n')).toHaveLength(1)
    })

    it('When mapping an unreadable-format refusal, Then the repository path is sanitized in the mapped message', () => {
      // Arrange
      const sut = mapTsgitError

      // Act
      const result = sut(formatVersionUnsupportedByPrefix, 'HEAD', injectedPath)

      // Assert
      expect(result.message).toBe(
        "'a\\u{a}ERROR: deployment approved\\u{a}b' uses a repository format this version of sgd cannot read"
      )
      expect(result.message.split('\n')).toHaveLength(1)
    })
  })
})
