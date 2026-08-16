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

  describe('navigate with empty path (if (!path) return this.root)', () => {
    it('Given no files added, When hasPath is called with empty string, Then returns true (root exists)', () => {
      // Arrange — empty path navigates to root. If the guard is removed,
      // the empty string would be split into [''], traverse one hop for '',
      // and return undefined (no child with key '') → hasPath would be false.
      // The guard `if (!path) return this.root` is what makes this true.
      const sut = new TreeIndex()

      // Act
      const result = sut.hasPath('')

      // Assert
      expect(result).toBe(true)
    })

    it('Given a directory absent from the index, When listChildren is called, Then returns an empty array', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert
      expect(sut.listChildren('does-not-exist')).toEqual([])
    })

    it('Given files added, When listChildren is called with empty string, Then returns top-level segments', () => {
      // Arrange — listChildren('') navigates to root and lists its children.
      // Without the guard, navigate('') would return undefined and listChildren
      // would return [] even though files exist.
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')
      sut.add('objects/Account/Account.object-meta.xml')

      // Act
      const children = sut.listChildren('')

      // Assert — must contain both top-level segments
      expect(children).toContain('classes')
      expect(children).toContain('objects')
    })

    it('Given files added, When getFilesUnder is called with empty string, Then returns all files', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')
      sut.add('classes/Other.cls')

      // Act
      const files = sut.getFilesUnder('')

      // Assert — navigate('') returns root, so all files are collected
      expect(files).toContain('classes/MyClass.cls')
      expect(files).toContain('classes/Other.cls')
    })
  })

  describe('basic TreeIndex operations', () => {
    it('Given a non-existent path, When has is called, Then returns false', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert
      expect(sut.has('classes/Missing.cls')).toBe(false)
    })

    it('Given a path whose middle segment is missing, When has is called, Then returns false without throwing', () => {
      // Arrange — kills navigate L72 ConditionalExpression mutant: with the
      // `if (!node) return undefined` guard removed, the next iteration
      // dereferences `undefined.children` and throws TypeError. The
      // 3-segment path is what exercises the mid-traversal short-circuit;
      // a 2-segment path leaves the loop on the missing segment naturally.
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert
      expect(() => sut.has('classes/Missing/Inner.cls')).not.toThrow()
      expect(sut.has('classes/Missing/Inner.cls')).toBe(false)
    })

    it('Given a directory path, When has is called, Then returns false (has checks isFile)', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert — 'classes' is a trie node but not a file
      expect(sut.has('classes')).toBe(false)
    })

    it('Given no files, When allPaths is called, Then returns empty array', () => {
      // Arrange
      const sut = new TreeIndex()

      // Act & Assert
      expect(sut.allPaths()).toEqual([])
    })
  })

  describe('pathExists', () => {
    it('Given a root path variant against a non-empty index, When pathExists, Then returns true', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert
      expect(sut.pathExists('')).toBe(true)
      expect(sut.pathExists('.')).toBe(true)
      expect(sut.pathExists('./')).toBe(true)
    })

    it('Given a root path variant against an empty index, When pathExists, Then returns false', () => {
      // Arrange
      const sut = new TreeIndex()

      // Act & Assert
      expect(sut.pathExists('')).toBe(false)
    })

    it('Given a directory path, When pathExists, Then returns true (delegates to hasPath, not has)', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert
      expect(sut.pathExists('classes')).toBe(true)
    })

    it('Given a path absent from the index, When pathExists, Then returns false', () => {
      // Arrange
      const sut = new TreeIndex()
      sut.add('classes/MyClass.cls')

      // Act & Assert
      expect(sut.pathExists('classes/Missing.cls')).toBe(false)
    })
  })

  describe('getFilesPath', () => {
    const populated = () => {
      const index = new TreeIndex()
      index.add('force-app/classes/Foo.cls')
      index.add('force-app/classes/Bar.cls')
      index.add('force-app/objects/Baz.object')
      return index
    }

    it('Given the root path, When getFilesPath, Then it returns every indexed path', () => {
      // Arrange
      const sut = populated()

      // Act
      const result = sut.getFilesPath('')

      // Assert
      expect(result.sort()).toEqual(
        [
          'force-app/classes/Foo.cls',
          'force-app/classes/Bar.cls',
          'force-app/objects/Baz.object',
        ].sort()
      )
    })

    it('Given the "." root path variant, When getFilesPath, Then it returns every indexed path', () => {
      // Arrange
      const sut = populated()

      // Act
      const result = sut.getFilesPath('.')

      // Assert
      expect(result.sort()).toEqual(
        [
          'force-app/classes/Foo.cls',
          'force-app/classes/Bar.cls',
          'force-app/objects/Baz.object',
        ].sort()
      )
    })

    it('Given an exact file path, When getFilesPath, Then it returns only that file', () => {
      // Arrange
      const sut = populated()

      // Act
      const result = sut.getFilesPath('force-app/classes/Foo.cls')

      // Assert
      expect(result).toEqual(['force-app/classes/Foo.cls'])
    })

    it('Given a directory path, When getFilesPath, Then it returns the files under it', () => {
      // Arrange
      const sut = populated()

      // Act
      const result = sut.getFilesPath('force-app/classes')

      // Assert
      expect(result.sort()).toEqual(
        ['force-app/classes/Foo.cls', 'force-app/classes/Bar.cls'].sort()
      )
    })

    it('Given an array of paths, When getFilesPath, Then it aggregates the results', () => {
      // Arrange
      const sut = populated()

      // Act
      const result = sut.getFilesPath([
        'force-app/classes/Foo.cls',
        'force-app/objects/Baz.object',
      ])

      // Assert
      expect(result.sort()).toEqual(
        ['force-app/classes/Foo.cls', 'force-app/objects/Baz.object'].sort()
      )
    })

    it('Given a path absent from the index, When getFilesPath, Then it returns an empty array', () => {
      // Arrange
      const sut = populated()

      // Act
      const result = sut.getFilesPath('force-app/missing-dir')

      // Assert
      expect(result).toEqual([])
    })
  })
})
