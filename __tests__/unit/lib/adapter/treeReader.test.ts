'use strict'
import { describe, expect, it } from 'vitest'
import { TreeIndex } from '../../../../src/adapter/treeIndex'
import {
  createTreeReader,
  EMPTY_TREE_READER,
} from '../../../../src/adapter/treeReader'

const buildIndex = (): TreeIndex => {
  const index = new TreeIndex()
  index.add('force-app/classes/Foo.cls')
  index.add('force-app/lwc/bar.js')
  return index
}

describe('createTreeReader', () => {
  describe('Given a reader built over one indexed revision', () => {
    describe('When pathExists is called for the indexed revision with a path present in the index', () => {
      it('Then it returns true', () => {
        // Arrange
        const sut = createTreeReader(new Map([['HEAD', buildIndex()]]))

        // Act
        const result = sut.pathExists('HEAD', 'force-app/classes/Foo.cls')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('When pathExists is called for a revision nobody built an index for', () => {
      it('Then it returns false', () => {
        // Arrange
        const sut = createTreeReader(new Map([['HEAD', buildIndex()]]))

        // Act
        const result = sut.pathExists('OTHER', 'force-app/classes/Foo.cls')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('When filesUnder is called for a revision nobody built an index for', () => {
      it('Then it returns an empty array', () => {
        // Arrange
        const sut = createTreeReader(new Map([['HEAD', buildIndex()]]))

        // Act
        const result = sut.filesUnder('OTHER', 'force-app')

        // Assert
        expect(result).toEqual([])
      })
    })

    describe('When children is called for a revision nobody built an index for', () => {
      it('Then it returns an empty array', () => {
        // Arrange
        const sut = createTreeReader(new Map([['HEAD', buildIndex()]]))

        // Act
        const result = sut.children('OTHER', 'force-app')

        // Assert
        expect(result).toEqual([])
      })
    })

    describe('When filesUnder is called with an array of paths for the indexed revision', () => {
      it('Then it returns the union of matches, in order', () => {
        // Arrange
        const sut = createTreeReader(new Map([['HEAD', buildIndex()]]))

        // Act
        const result = sut.filesUnder('HEAD', [
          'force-app/classes',
          'force-app/lwc',
        ])

        // Assert
        expect(result).toEqual([
          'force-app/classes/Foo.cls',
          'force-app/lwc/bar.js',
        ])
      })
    })

    describe('When children is called for the indexed revision', () => {
      it('Then it returns the direct child segments', () => {
        // Arrange
        const sut = createTreeReader(new Map([['HEAD', buildIndex()]]))

        // Act
        const result = sut.children('HEAD', 'force-app')

        // Assert
        expect(result).toEqual(['classes', 'lwc'])
      })
    })
  })

  describe('Given EMPTY_TREE_READER', () => {
    describe.each([
      ['', 'empty string'],
      ['.', 'dot'],
      ['./', 'dot-slash'],
    ])('When queried on the root-path form %j (%s)', path => {
      it('Then pathExists returns false', () => {
        // Act & Assert
        expect(EMPTY_TREE_READER.pathExists('HEAD', path)).toBe(false)
      })

      it('Then filesUnder returns an empty array', () => {
        // Act & Assert
        expect(EMPTY_TREE_READER.filesUnder('HEAD', path)).toEqual([])
      })

      it('Then children returns an empty array', () => {
        // Act & Assert
        expect(EMPTY_TREE_READER.children('HEAD', path)).toEqual([])
      })
    })

    describe('When queried on an ordinary path', () => {
      it('Then pathExists returns false', () => {
        // Act & Assert
        expect(
          EMPTY_TREE_READER.pathExists('HEAD', 'force-app/classes/Foo.cls')
        ).toBe(false)
      })

      it('Then filesUnder returns an empty array', () => {
        // Act & Assert
        expect(EMPTY_TREE_READER.filesUnder('HEAD', 'force-app')).toEqual([])
      })

      it('Then children returns an empty array', () => {
        // Act & Assert
        expect(EMPTY_TREE_READER.children('HEAD', 'force-app')).toEqual([])
      })
    })
  })

  describe('Given EMPTY_TREE_READER and a freshly created reader over an empty map', () => {
    it('When each method is queried with the same arguments, Then both readers answer identically (no drift between the constant and the factory)', () => {
      // Arrange
      const sut = createTreeReader(new Map())

      // Act & Assert
      expect(EMPTY_TREE_READER.pathExists('HEAD', 'force-app')).toBe(
        sut.pathExists('HEAD', 'force-app')
      )
      expect(EMPTY_TREE_READER.filesUnder('HEAD', 'force-app')).toEqual(
        sut.filesUnder('HEAD', 'force-app')
      )
      expect(EMPTY_TREE_READER.children('HEAD', 'force-app')).toEqual(
        sut.children('HEAD', 'force-app')
      )
    })
  })
})
