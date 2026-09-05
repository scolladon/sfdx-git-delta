'use strict'
import { describe, expect, it, vi } from 'vitest'

import {
  buildScopeMatcher,
  inScope,
} from '../../../../src/adapter/pathMatching'

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
})

describe('buildScopeMatcher', () => {
  describe('Given a matcher built once from a scopes array (buildTreeIndex-style loop)', () => {
    it('When the matcher runs for each path, Then the scope set is built only once', () => {
      // Arrange — buildTreeIndex builds the matcher once and calls it for
      // every tree path; the scan behind the scope membership test must not
      // redo its setup work on every call, which is the O(files x scopes)
      // cost a per-call rebuild would reintroduce.
      const scopes = ['force-app']
      const someSpy = vi.spyOn(scopes, 'some')
      const matcher = buildScopeMatcher(scopes)

      // Act
      const first = matcher('other/a.cls')
      const second = matcher('other/b.cls')

      // Assert
      expect(first).toBe(false)
      expect(second).toBe(false)
      expect(someSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Given the same scopes contents in two different array instances', () => {
    it('When each is built into its own matcher, Then both answer independently (no shared reference-keyed state)', () => {
      // Arrange — a caller may pass a fresh literal per call (e.g.
      // streamArchive's per-file `[path]`); two distinct arrays with equal
      // contents must not depend on any cross-instance cache to agree.
      const path = 'force-app/foo.cls'
      const firstMatcher = buildScopeMatcher(['force-app'])
      const secondMatcher = buildScopeMatcher(['force-app'])

      // Act
      const first = firstMatcher(path)
      const second = secondMatcher(path)

      // Assert
      expect(first).toBe(true)
      expect(second).toBe(true)
    })
  })
})
