'use strict'
import { describe, expect, it, vi } from 'vitest'

import { inScope } from '../../../../src/adapter/pathMatching'

describe('inScope', () => {
  describe('Given a path nested several levels below a scope', () => {
    it('When checked, Then it is in scope', () => {
      // Arrange
      const scopes = ['force-app/lwc']
      const path = 'force-app/lwc/foo/bar.js'

      // Act
      const sut = inScope(path, scopes)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('Given a path that only shares a string prefix with a scope', () => {
    it('When checked, Then the sibling directory is not in scope', () => {
      // Arrange — the classic `startsWith` false positive: 'lwc/foo' must
      // not match 'lwc/foobar/x.js'.
      const scopes = ['lwc/foo']
      const path = 'lwc/foobar/x.js'

      // Act
      const sut = inScope(path, scopes)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('Given a scope equal to the whole path', () => {
    it('When checked, Then it is in scope', () => {
      // Arrange
      const scopes = ['force-app']
      const path = 'force-app'

      // Act
      const sut = inScope(path, scopes)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('Given scopes containing a root marker', () => {
    it('When checked for any unrelated path, Then it is in scope', () => {
      // Arrange
      const scopes = ['.', 'unrelated']
      const path = 'anything/at/all.cls'

      // Act
      const sut = inScope(path, scopes)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('Given no scope matches and no root marker is present', () => {
    it('When checked, Then it is not in scope', () => {
      // Arrange
      const scopes = ['other']
      const path = 'force-app/foo.cls'

      // Act
      const sut = inScope(path, scopes)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('Given an empty scopes array', () => {
    it('When checked, Then it is not in scope', () => {
      // Arrange
      const scopes: string[] = []
      const path = 'force-app/foo.cls'

      // Act
      const sut = inScope(path, scopes)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('Given the same scopes array checked across multiple paths (buildTreeIndex-style loop)', () => {
    it('When inScope runs for each path, Then the scope set is built only once', () => {
      // Arrange — buildTreeIndex builds `scopes` once and calls inScope for
      // every tree path with that same reference; the scan behind the scope
      // membership test must not redo its setup work on every call, which is
      // the O(files x scopes) cost this replaces.
      const scopes = ['force-app']
      const someSpy = vi.spyOn(scopes, 'some')

      // Act
      const first = inScope('other/a.cls', scopes)
      const second = inScope('other/b.cls', scopes)

      // Assert
      expect(first).toBe(false)
      expect(second).toBe(false)
      expect(someSpy).toHaveBeenCalledTimes(1)
    })
  })
})
