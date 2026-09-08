import { describe, expect, it } from 'vitest'

import {
  applyNegations,
  convertGlobWildcards,
  escapeGlobLiteral,
  globToRegExp,
  negationsOf,
} from '../../../tooling/mutationScope.ts'

describe('Given a glob literal chunk with regex metacharacters', () => {
  describe('When every metacharacter appears in the chunk', () => {
    it('Then each one is backslash-escaped', () => {
      const sut = escapeGlobLiteral

      const result = sut('.+^${}()|[]\\')

      expect(result).toBe('\\.\\+\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
    })
  })

  describe('When the chunk has no metacharacters', () => {
    it('Then it passes through unchanged', () => {
      const sut = escapeGlobLiteral

      const result = sut('src/metadata')

      expect(result).toBe('src/metadata')
    })
  })
})

describe('Given a glob chunk with wildcards', () => {
  describe('When the chunk has a single-character wildcard', () => {
    it('Then ? converts to a single-segment character class', () => {
      const sut = convertGlobWildcards

      const result = sut('v?.ts')

      expect(result).toBe('v[^/]\\.ts')
    })
  })

  describe('When the chunk has a multi-character wildcard', () => {
    it('Then * converts to a greedy single-segment class', () => {
      const sut = convertGlobWildcards

      const result = sut('v*.ts')

      expect(result).toBe('v[^/]*\\.ts')
    })
  })

  describe('When the chunk also has a regex metacharacter', () => {
    it('Then the metacharacter is escaped before wildcards convert', () => {
      const sut = convertGlobWildcards

      const result = sut('a+*b')

      expect(result).toBe('a\\+[^/]*b')
    })
  })
})

describe('Given a glob pattern compiled to a RegExp', () => {
  describe('When the pattern has a single trailing wildcard segment', () => {
    it('Then it matches a file in that directory only', () => {
      const sut = globToRegExp

      const result = sut('src/metadata/v*.ts')

      expect(result.test('src/metadata/v59.ts')).toBe(true)
      expect(result.test('src/metadata/metadata.ts')).toBe(false)
    })
  })

  describe('When the pattern has a mid-pattern globstar', () => {
    it('Then it matches files at any depth under the directory', () => {
      const sut = globToRegExp

      const result = sut('src/commands/**/*.ts')

      expect(result.test('src/commands/delta.ts')).toBe(true)
      expect(result.test('src/commands/sgd/source/delta.ts')).toBe(true)
    })
  })

  describe('When the pattern has no wildcard at all', () => {
    it('Then it matches only the literal path', () => {
      const sut = globToRegExp

      const result = sut('src/constant/cliConstants.ts')

      expect(result.test('src/constant/cliConstants.ts')).toBe(true)
    })
  })

  describe('When the pattern is a directory globstar with no leading segment', () => {
    it('Then it matches nested files at any depth', () => {
      const sut = globToRegExp

      const result = sut('src/utils/__mocks__/**/*.ts')

      expect(result.test('src/utils/__mocks__/x.ts')).toBe(true)
      expect(result.test('src/utils/__mocks__/a/b.ts')).toBe(true)
    })
  })

  describe('When the pattern ends with a trailing globstar', () => {
    it('Then it matches the directory itself and everything under it at any depth', () => {
      const sut = globToRegExp

      const result = sut('src/service/**')

      expect(result.test('src/service')).toBe(true)
      expect(result.test('src/service/a/b/c.ts')).toBe(true)
    })
  })

  describe('When a bare ** appears mid-segment rather than as a standalone directory token', () => {
    it('Then it degrades to two single-segment wildcards, not a globstar', () => {
      const sut = globToRegExp

      const result = sut('a**b')

      expect(result.test('axxb')).toBe(true)
      expect(result.test('a/b')).toBe(false)
    })
  })
})

describe('Given the mutate config negation list', () => {
  describe('When the list has both negated and non-negated patterns', () => {
    it('Then only the negated patterns compile to regexes, with the ! stripped', () => {
      const sut = negationsOf

      const result = sut([
        'src/**/*.ts',
        '!src/metadata/v*.ts',
        '!src/commands/**/*.ts',
      ])

      expect(result).toHaveLength(2)
      expect(result[0]?.test('src/metadata/v59.ts')).toBe(true)
      expect(result[1]?.test('src/commands/sgd/source/delta.ts')).toBe(true)
    })
  })

  describe('When the list has no negated patterns', () => {
    it('Then the result is empty', () => {
      const sut = negationsOf

      const result = sut(['src/**/*.ts'])

      expect(result).toEqual([])
    })
  })
})

describe('Given a file list and a set of negation regexes', () => {
  describe('When no negation matches a file', () => {
    it('Then the file is kept', () => {
      const sut = applyNegations

      const result = sut(['src/service/handler.ts'], [/^src\/metadata\/v/])

      expect(result).toEqual(['src/service/handler.ts'])
    })
  })

  describe('When a negation matches a file', () => {
    it('Then the file is dropped', () => {
      const sut = applyNegations

      const result = sut(
        ['src/metadata/v59.ts', 'src/service/handler.ts'],
        [/^src\/metadata\/v/]
      )

      expect(result).toEqual(['src/service/handler.ts'])
    })
  })
})
