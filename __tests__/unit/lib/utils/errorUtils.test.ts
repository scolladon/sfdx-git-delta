'use strict'
import { describe, expect, it } from '@jest/globals'

import {
  ConfigError,
  getErrorMessage,
  MetadataRegistryError,
  SgdError,
  wrapError,
} from '../../../../src/utils/errorUtils'

describe('getErrorMessage', () => {
  it.each([
    {
      input: new Error('test error message'),
      expected: 'test error message',
      desc: 'Error instance',
    },
    { input: 'string error', expected: 'string error', desc: 'string' },
    { input: 42, expected: '42', desc: 'number' },
    { input: null, expected: 'null', desc: 'null' },
    { input: undefined, expected: 'undefined', desc: 'undefined' },
    { input: { code: 'ERR_001' }, expected: '[object Object]', desc: 'object' },
  ])('Given $desc, When called, Then returns "$expected"', ({
    input,
    expected,
  }) => {
    // Act
    const result = getErrorMessage(input)

    // Assert
    expect(result).toBe(expected)
  })
})

describe('SgdError', () => {
  it('Given a message, When constructed, Then is an instance of Error with name SgdError', () => {
    // Act
    const error = new SgdError('test')

    // Assert
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SgdError)
    expect(error.name).toBe('SgdError')
    expect(error.message).toBe('test')
  })

  it('Given a cause, When constructed, Then preserves the cause', () => {
    // Arrange
    const cause = new Error('root')

    // Act
    const error = new SgdError('wrapped', { cause })

    // Assert
    expect(error.cause).toBe(cause)
  })
})

describe('ConfigError', () => {
  it('Given a message, When constructed, Then is an instance of SgdError', () => {
    // Act
    const error = new ConfigError('bad config')

    // Assert
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SgdError)
    expect(error).toBeInstanceOf(ConfigError)
    expect(error.name).toBe('ConfigError')
  })
})

describe('MetadataRegistryError', () => {
  it('Given a message, When constructed, Then is an instance of SgdError', () => {
    // Act
    const error = new MetadataRegistryError('bad registry')

    // Assert
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SgdError)
    expect(error).toBeInstanceOf(MetadataRegistryError)
    expect(error.name).toBe('MetadataRegistryError')
  })
})

describe('wrapError', () => {
  describe('Given a message and Error cause', () => {
    it('When called, Then creates SgdError with message and cause', () => {
      // Arrange
      const message = 'wrapped error message'
      const cause = new Error('original error')

      // Act
      const result = wrapError(message, cause)

      // Assert
      expect(result).toBeInstanceOf(SgdError)
      expect(result.message).toBe('wrapped error message')
      expect(result.cause).toBe(cause)
    })
  })

  describe('Given a message and string cause', () => {
    it('When called, Then preserves string cause', () => {
      // Arrange
      const message = 'wrapped error'
      const cause = 'string cause'

      // Act
      const result = wrapError(message, cause)

      // Assert
      expect(result).toBeInstanceOf(SgdError)
      expect(result.message).toBe('wrapped error')
      expect(result.cause).toBe('string cause')
    })
  })

  describe('Given a message and null cause', () => {
    it('When called, Then preserves null cause', () => {
      // Arrange
      const message = 'wrapped error'
      const cause = null

      // Act
      const result = wrapError(message, cause)

      // Assert
      expect(result).toBeInstanceOf(SgdError)
      expect(result.message).toBe('wrapped error')
      expect(result.cause).toBe(null)
    })
  })

  describe('Given nested errors', () => {
    it('When called, Then maintains error chain', () => {
      // Arrange
      const rootCause = new Error('root cause')
      const middleError = wrapError('middle error', rootCause)

      // Act
      const result = wrapError('top level error', middleError)

      // Assert
      expect(result.message).toBe('top level error')
      expect((result.cause as Error).message).toBe('middle error')
      expect(((result.cause as Error).cause as Error).message).toBe(
        'root cause'
      )
    })
  })
})
