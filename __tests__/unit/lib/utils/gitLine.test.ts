'use strict'
import { describe, expect, it } from 'vitest'

import {
  additionLineOf,
  lineOf,
  pathOfLine,
} from '../../../../src/utils/gitLine'

describe('Given git diff line helpers', () => {
  it('When a type and a path are given, Then the tab separated line is built', () => {
    // Act
    const result = lineOf('M', 'a/b.cls')

    // Assert
    expect(result).toBe('M\ta/b.cls')
  })

  it('When a path is given, Then the addition line is built', () => {
    // Act
    const result = additionLineOf('a/b.cls')

    // Assert
    expect(result).toBe('A\ta/b.cls')
  })

  it('When a line is given, Then its path is extracted', () => {
    // Act
    const result = pathOfLine('D\ta/b.cls')

    // Assert
    expect(result).toBe('a/b.cls')
  })
})
