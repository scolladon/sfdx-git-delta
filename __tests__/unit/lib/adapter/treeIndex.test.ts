'use strict'
import { describe, expect, it } from 'vitest'

import { TreeIndex } from '../../../../src/adapter/treeIndex'

describe('TreeIndex', () => {
  describe('Given the same path added twice', () => {
    it('When add is called twice, Then size stays at 1 (idempotent)', () => {
      // Arrange
      const sut = new TreeIndex()
      const path = 'force-app/main/default/classes/MyClass.cls'

      // Act
      sut.add(path)
      sut.add(path)

      // Assert
      expect(sut.size).toBe(1)
      expect(sut.has(path)).toBe(true)
    })
  })
})
