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

  describe('When it contains a bidirectional-override character (Cf category)', () => {
    it('Then the character is replaced with its escaped hex form', () => {
      // Act — U+202E (RIGHT-TO-LEFT OVERRIDE) would otherwise reverse the
      // display of the rest of the line in a bidi-aware renderer.
      const result = sut('nope/\u202Egnp.exe')

      // Assert
      expect(result).toBe('nope/\\x202egnp.exe')
      expect(result).not.toContain('\u202E')
    })
  })

  describe('When it contains a line separator (U+2028)', () => {
    it('Then the character is replaced with its escaped hex form', () => {
      // Act — U+2028 is neither Cc nor Cf, so it needs its own entry in
      // the character class.
      const result = sut('force-app\u2028PASSED')

      // Assert
      expect(result).toBe('force-app\\x2028PASSED')
      expect(result).not.toContain('\u2028')
    })
  })

  describe('When it contains a paragraph separator (U+2029)', () => {
    it('Then the character is replaced with its escaped hex form', () => {
      // Act
      const result = sut('force-app\u2029PASSED')

      // Assert
      expect(result).toBe('force-app\\x2029PASSED')
      expect(result).not.toContain('\u2029')
    })
  })

  describe('When a surrogate pair straddles the truncation cap', () => {
    it('Then the pair is kept or dropped whole, never split into a lone surrogate', () => {
      // Arrange — the emoji is a single code point sitting exactly at the
      // 200th position; slicing UTF-16 code units instead of code points
      // would cut it in half and leave a lone (ill-formed) surrogate.
      const value = `${'a'.repeat(199)}\u{1F600}PASSED`

      // Act
      const result = sut(value)

      // Assert
      expect(result).toBe(`${'a'.repeat(199)}\u{1F600}…`)
      expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
      expect(result).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/)
    })
  })

  describe('When the truncation boundary would land inside an escape sequence under naive post-escape slicing', () => {
    it('Then the escape sequence is emitted whole, never a dangling fragment', () => {
      // Arrange — escaping ESC before truncating would expand it to the
      // 4-character '\x1b' sequence straddling the 200-char cut point;
      // truncating the raw value first (then escaping) avoids that.
      const value = `${'a'.repeat(199)}${ESC}PASSEDTAIL`

      // Act
      const result = sut(value)

      // Assert
      expect(result).toBe(`${'a'.repeat(199)}\\x1b…`)
    })
  })

  describe('When it contains a literal backslash followed by an escape-shaped sequence', () => {
    it('Then it sanitizes to a different string than an equivalent real control character, because the backslash itself is escaped', () => {
      // Arrange — without escaping the literal backslash first, a path
      // containing the four characters \, x, 0, a is indistinguishable
      // from a real newline after sanitization.
      const literalInput = 'force-app\\x0aPASSED'
      const newlineInput = 'force-app\nPASSED'

      // Act
      const literalResult = sut(literalInput)
      const newlineResult = sut(newlineInput)

      // Assert
      expect(literalResult).not.toBe(newlineResult)
      expect(literalResult).toBe('force-app\\\\x0aPASSED')
      expect(newlineResult).toBe('force-app\\x0aPASSED')
    })
  })
})
