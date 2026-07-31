'use strict'
import { describe, expect, it } from 'vitest'

import { mapTsgitError } from '../../../../src/adapter/tsgitErrorMap'

const enoentRealpath = Object.assign(
  new Error("ENOENT: no such file or directory, realpath '/missing/repo'"),
  { code: 'ENOENT' }
)

const enoentOther = Object.assign(
  new Error("ENOENT: no such file or directory, open '/repo/some-file'"),
  { code: 'ENOENT' }
)

const objectNotFoundByCode = Object.assign(
  new Error('object not found: deadbeef'),
  { code: 'OBJECT_NOT_FOUND' }
)

const objectNotFoundByMessage = new Error(
  'OBJECT_NOT_FOUND: object not found: cafebabe'
)

const genericTsgitError = new Error('TsgitError: something else broke')

describe('Given mapTsgitError', () => {
  it.each([
    [
      'an ENOENT error naming realpath',
      enoentRealpath,
      '/missing/repo',
      "'/missing/repo' is not a git repository",
    ],
    [
      'an ENOENT error not naming realpath',
      enoentOther,
      'some-context',
      "git operation failed: ENOENT: no such file or directory, open '/repo/some-file'",
    ],
    [
      'an OBJECT_NOT_FOUND error identified by code only',
      objectNotFoundByCode,
      'HEAD~999',
      'HEAD~999: not a valid git revision',
    ],
    [
      'an OBJECT_NOT_FOUND error identified by message prefix only',
      objectNotFoundByMessage,
      'ref',
      'ref: not a valid git revision',
    ],
    [
      'a generic Error with no recognized shape',
      genericTsgitError,
      'op',
      'git operation failed: TsgitError: something else broke',
    ],
    [
      'a non-Error thrown value',
      'raw-string-failure',
      'op',
      'git operation failed: raw-string-failure',
    ],
    ['a null thrown value', null, 'op', 'git operation failed: null'],
  ])(
    'When mapping %s, Then it returns %s',
    (_description, error, context, expected) => {
      // Arrange
      const sut = mapTsgitError

      // Act
      const result = sut(error, context)

      // Assert
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe(expected)
    }
  )

  it('When mapping a raw error, Then the mapped message never leaks the raw code', () => {
    // Arrange
    const sut = mapTsgitError

    // Act
    const result = sut(objectNotFoundByCode, 'HEAD~999')

    // Assert
    expect(result.message).not.toContain('OBJECT_NOT_FOUND')
  })
})
