'use strict'
import { describe, expect, it } from 'vitest'

import { sanitizeForMessage } from '../../../../src/utils/messageSanitizer'

const ESC = String.fromCharCode(27)

describe('Given a value bound for an error or warning message', () => {
  const sut = sanitizeForMessage

  describe('When it contains no control characters and stays under the length cap', () => {
    it('Then it is returned unchanged', () => {
      // Act
      const result = sut('force-app/main/default')

      // Assert
      expect(result).toBe('force-app/main/default')
    })
  })

  describe('When it contains an ANSI escape sequence', () => {
    it('Then the escape character is replaced with its escaped hex form', () => {
      // Act
      const result = sut(`${ESC}[2K${ESC}[32mPASSED${ESC}[0m`)

      // Assert
      expect(result).toBe('\\x1b[2K\\x1b[32mPASSED\\x1b[0m')
      expect(result).not.toContain(ESC)
    })
  })

  describe('When it contains a newline', () => {
    it('Then the newline is replaced with its escaped hex form', () => {
      // Act
      const result = sut('force-app\nPASSED')

      // Assert
      expect(result).toBe('force-app\\x0aPASSED')
    })
  })

  describe('When it is exactly at the length cap', () => {
    it('Then it is returned unchanged', () => {
      // Arrange
      const value = 'a'.repeat(200)

      // Act
      const result = sut(value)

      // Assert
      expect(result).toBe(value)
      expect(result).toHaveLength(200)
    })
  })

  describe('When it exceeds the length cap', () => {
    it('Then it is truncated to the cap with a trailing marker', () => {
      // Arrange
      const value = 'a'.repeat(250)

      // Act
      const result = sut(value)

      // Assert
      expect(result).toBe(`${'a'.repeat(200)}…`)
    })
  })
})
