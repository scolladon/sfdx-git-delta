'use strict'
import { describe, expect, it } from 'vitest'
import { TreeIndex } from '../../../../src/adapter/treeIndex'
import {
  createTreeIndexes,
  EMPTY_TREE_INDEXES,
} from '../../../../src/adapter/treeIndexes'

describe('treeIndexes', () => {
  describe('EMPTY_TREE_INDEXES', () => {
    it('Given any revision, When at is called, Then it returns undefined', () => {
      // Arrange
      const sut = EMPTY_TREE_INDEXES

      // Act & Assert
      expect(sut.at('HEAD')).toBeUndefined()
    })
  })

  describe('createTreeIndexes', () => {
    it("Given a revision present in the entries map, When at is called, Then it returns that revision's TreeIndex", () => {
      // Arrange
      const index = new TreeIndex()
      index.add('force-app/classes/Foo.cls')
      const sut = createTreeIndexes(new Map([['HEAD', index]]))

      // Act
      const actual = sut.at('HEAD')

      // Assert
      expect(actual).toBe(index)
    })

    it('Given a revision absent from the entries map, When at is called, Then it returns undefined', () => {
      // Arrange
      const index = new TreeIndex()
      const sut = createTreeIndexes(new Map([['HEAD', index]]))

      // Act
      const actual = sut.at('OTHER')

      // Assert
      expect(actual).toBeUndefined()
    })
  })
})
