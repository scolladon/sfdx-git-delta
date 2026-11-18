'use strict'

import type { ObjectId } from '@scolladon/tsgit'
import { describe, expect, it } from 'vitest'

import { buildScopeMatcher } from '../../../../src/adapter/pathMatching'
import {
  lowerBound,
  SortedPathIndex,
} from '../../../../src/adapter/sortedPathIndex'

describe('Given lowerBound', () => {
  it.each([
    ['the key is at index 0', ['a', 'b', 'c'], 'a', 0],
    ['the key is at the last index', ['a', 'b', 'c'], 'c', 2],
    ['the key is in the middle', ['a', 'b', 'c'], 'b', 1],
    ['the key is absent between two entries', ['a', 'c'], 'b', 1],
    ['the key is smaller than all entries', ['b', 'c'], 'a', 0],
    ['the key is larger than all entries', ['a', 'b'], 'z', 2],
    ['the array is empty', [], 'a', 0],
  ])(
    'When %s, Then it returns the first index not below the key',
    (_title, sorted, key, expected) => {
      // Arrange
      const sut = lowerBound

      // Act
      const result = sut(sorted, key)

      // Assert
      expect(result).toBe(expected)
    }
  )
})

const BRACKET_PATH = 'objects/Custom[1]__c/fields/F.field-meta.xml'
const CORPUS = [
  'force-app/sub/bar.cls',
  BRACKET_PATH,
  'a/b',
  'force-app-legacy/l.cls',
  'a.b',
  'force-app/foo.cls',
]

const asBlobIds = (paths: string[]): Map<string, ObjectId> =>
  new Map(paths.map(path => [path, `id-${path}` as ObjectId]))

describe('Given a SortedPathIndex over a mixed corpus', () => {
  it.each([
    ['a file spec', ['force-app/foo.cls'], ['force-app/foo.cls']],
    [
      'a directory spec',
      ['force-app'],
      ['force-app/foo.cls', 'force-app/sub/bar.cls'],
    ],
    ['a directory spec sharing a prefix with a file', ['a'], ['a/b']],
    ['the empty root', [''], [...CORPUS].sort()],
    ['the dot root', ['.'], [...CORPUS].sort()],
    ['the dot-slash root', ['./'], [...CORPUS].sort()],
    ['an unknown spec', ['nope'], []],
    ['a trailing slash spec', ['force-app/'], []],
    ['a leading dot-slash spec', ['./force-app'], []],
    ['a bracketed directory spec', ['objects/Custom[1]__c'], [BRACKET_PATH]],
    [
      'overlapping specs',
      ['force-app', 'force-app/sub'],
      ['force-app/foo.cls', 'force-app/sub/bar.cls'],
    ],
    [
      'a child directory before its parent',
      ['force-app/sub', 'force-app'],
      ['force-app/sub/bar.cls', 'force-app/foo.cls'],
    ],
    [
      'a file before its directory',
      ['force-app/sub/bar.cls', 'force-app'],
      ['force-app/sub/bar.cls', 'force-app/foo.cls'],
    ],
  ])(
    'When resolving %s, Then it returns the matching paths once, in first-seen order',
    (_title, specs, expected) => {
      // Arrange
      const sut = new SortedPathIndex(asBlobIds(CORPUS))

      // Act
      const result = sut.pathsFor(specs)

      // Assert
      expect(result).toEqual(expected)
    }
  )

  it('When the blob map is empty, Then every spec resolves to nothing', () => {
    // Arrange
    const sut = new SortedPathIndex(new Map())

    // Act
    const result = sut.pathsFor(['', 'force-app', 'force-app/foo.cls'])

    // Assert
    expect(result).toEqual([])
  })

  it('When a blob map is inserted in UTF-8 byte order, Then paths come back in code-unit order', () => {
    // Arrange
    const sut = new SortedPathIndex(asBlobIds(['a/～x', 'a/😀x']))

    // Act
    const result = sut.pathsFor(['a'])

    // Assert
    expect(result).toEqual(['a/😀x', 'a/～x'])
  })

  it('When compared with the scope matcher for every directory prefix, full path and edge spec, Then both select the same paths', () => {
    // Arrange
    const sut = new SortedPathIndex(asBlobIds(CORPUS))
    const prefixes = CORPUS.flatMap(path =>
      path
        .split('/')
        .map((_segment, index, segments) =>
          segments.slice(0, index + 1).join('/')
        )
    )
    const specs = [
      ...new Set([
        ...prefixes,
        '',
        '.',
        './',
        'nope',
        'force-app/',
        './force-app',
      ]),
    ]

    // Act
    const mismatches = specs.filter(spec => {
      const expected = new Set(CORPUS.filter(buildScopeMatcher([spec])))
      return (
        new Set(sut.pathsFor([spec])).size !== expected.size ||
        sut.pathsFor([spec]).some(path => !expected.has(path))
      )
    })

    // Assert
    expect(mismatches).toEqual([])
  })
})
