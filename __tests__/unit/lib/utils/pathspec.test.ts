'use strict'
import { describe, expect, it } from 'vitest'

import { parseSourceDirs } from '../../../../src/utils/pathspec'
import { sourceDirs } from '../../../__utils__/sourceDirs'

describe('Given a raw --source-dir value', () => {
  const sut = parseSourceDirs

  describe('When it canonicalises to a literal pathspec', () => {
    it.each([
      { raw: 'force-app', expected: 'force-app' },
      { raw: 'force-app/', expected: 'force-app' },
      { raw: 'force-app//', expected: 'force-app' },
      { raw: './force-app', expected: 'force-app' },
      { raw: './force-app/', expected: 'force-app' },
      { raw: '.', expected: '.' },
      { raw: './', expected: '.' },
      { raw: '././', expected: '.' },
      { raw: 'force-app/main', expected: 'force-app/main' },
      {
        raw: 'force-app/main/default/classes/Foo.cls',
        expected: 'force-app/main/default/classes/Foo.cls',
      },
      { raw: 'force-app/./main', expected: 'force-app/main' },
      { raw: 'force-app-legacy', expected: 'force-app-legacy' },
      { raw: 'FORCE-APP', expected: 'FORCE-APP' },
      { raw: 'does-not-exist', expected: 'does-not-exist' },
      { raw: 'a:b', expected: 'a:b' },
      { raw: '   ', expected: '   ' },
    ])(
      'Given raw $raw, When parsed, Then pathspecs is [$expected] and rejections is empty',
      ({ raw, expected }) => {
        // Act
        const result = sut([raw])

        // Assert
        expect(result).toEqual({ pathspecs: [expected], rejections: [] })
      }
    )
  })

  describe('When it must be rejected', () => {
    it.each([
      { raw: '', reason: 'empty' },
      { raw: '/', reason: 'absolute' },
      { raw: '/etc', reason: 'absolute' },
      { raw: '/tmp/repo/force-app', reason: 'absolute' },
      { raw: 'C:/force-app', reason: 'absolute' },
      { raw: 'C:\\force-app', reason: 'absolute' },
      { raw: '\\\\server\\share', reason: 'absolute' },
      { raw: '..', reason: 'escapes' },
      { raw: '../sibling', reason: 'escapes' },
      { raw: 'force-app/..', reason: 'escapes' },
      { raw: 'a/b/../..', reason: 'escapes' },
      { raw: './force-app/..', reason: 'escapes' },
      { raw: 'force-app/./..', reason: 'escapes' },
      { raw: 'force-app/../force-app', reason: 'escapes' },
      { raw: 'force-app/*', reason: 'wildcard' },
      { raw: 'force-app/**', reason: 'wildcard' },
      { raw: 'force-app/**/', reason: 'wildcard' },
      { raw: '*', reason: 'wildcard' },
      { raw: '**', reason: 'wildcard' },
      { raw: '*.cls', reason: 'wildcard' },
      { raw: '**/*.cls', reason: 'wildcard' },
      { raw: '*/classes', reason: 'wildcard' },
      { raw: 'force-app[', reason: 'wildcard' },
      { raw: 'force-app/f?o.cls', reason: 'wildcard' },
      { raw: ':(exclude)force-app', reason: 'magic' },
      { raw: ':!force-app', reason: 'magic' },
      { raw: ':(glob)force-app/**', reason: 'magic' },
      { raw: ':(icase)FORCE-APP', reason: 'magic' },
      { raw: ':(bogus)x', reason: 'magic' },
      { raw: ':/', reason: 'magic' },
      { raw: ':^force-app', reason: 'magic' },
    ])(
      'Given raw $raw, When parsed, Then it is rejected as $reason',
      ({ raw, reason }) => {
        // Act
        const result = sut([raw])

        // Assert
        expect(result).toEqual({
          pathspecs: [],
          rejections: [{ value: raw, reason }],
        })
      }
    )
  })

  describe('When it is force-app[', () => {
    it('Then it is rejected and nothing is thrown', () => {
      // Act
      const act = () => sut(['force-app['])

      // Assert
      expect(act).not.toThrow()
      expect(act()).toEqual({
        pathspecs: [],
        rejections: [{ value: 'force-app[', reason: 'wildcard' }],
      })
    })
  })
})

describe('Given a list of raw --source-dir values', () => {
  const sut = parseSourceDirs

  describe('When the list is empty', () => {
    it('Then no pathspec and no rejection is produced', () => {
      // Act
      const result = sut([])

      // Assert
      expect(result).toEqual({ pathspecs: [], rejections: [] })
    })
  })

  describe('When duplicate raw values canonicalise to the same pathspec', () => {
    it('Then only one pathspec is produced, in first-seen order', () => {
      // Arrange
      const raw = ['force-app', 'force-app/', './force-app']

      // Act
      const result = sut(raw)

      // Assert
      expect(result).toEqual({ pathspecs: ['force-app'], rejections: [] })
    })
  })

  describe('When distinct raw values include the whole-repository root', () => {
    it('Then both pathspecs are produced, in first-seen order', () => {
      // Arrange
      const raw = ['.', 'force-app']

      // Act
      const result = sut(raw)

      // Assert
      expect(result).toEqual({
        pathspecs: ['.', 'force-app'],
        rejections: [],
      })
    })
  })

  describe('When the list mixes an accepted value and a rejected value', () => {
    it('Then both outputs are produced from the same pass', () => {
      // Arrange
      const raw = ['force-app', 'force-app/**']

      // Act
      const result = sut(raw)

      // Assert
      expect(result).toEqual({
        pathspecs: ['force-app'],
        rejections: [{ value: 'force-app/**', reason: 'wildcard' }],
      })
    })
  })
})

describe('Given the sourceDirs test helper', () => {
  const sut = sourceDirs

  describe('When a fixture arranges a rejected value', () => {
    it('Then it throws naming the value and the reason', () => {
      // Act & Assert
      expect(() => sut('force-app/**')).toThrow(/force-app\/\*\*.*wildcard/)
    })
  })

  describe('When a fixture arranges a trailing slash', () => {
    it('Then it yields the canonical value', () => {
      // Act
      const result = sut('force-app/')

      // Assert
      expect(result).toEqual(['force-app'])
    })
  })
})
