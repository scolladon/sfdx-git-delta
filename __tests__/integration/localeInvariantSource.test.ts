'use strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// sgd's manifests are a deployment artifact: the same repository at the same
// commits must produce the same bytes on every machine. Locale-aware string
// APIs read the host default locale, so they silently make that untrue — a
// Turkish host folds 'I' to a dotless 'ı', and ICU collation tailorings order
// even pure-ASCII names differently. Guarding the source rather than a single
// call site is what keeps the next one from being written.
const FORBIDDEN = [
  { pattern: /\.toLocaleLowerCase\(/g, use: 'toLowerCase()' },
  { pattern: /\.toLocaleUpperCase\(/g, use: 'toUpperCase()' },
  {
    pattern: /\.localeCompare\([^,)]*\)/g,
    use: 'a code-unit comparison, or localeCompare with an explicit locale',
  },
]

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })

const lineOf = (content: string, index: number): number =>
  content.slice(0, index).split('\n').length

describe('Given the shipped source', () => {
  it('When it is scanned for locale-aware string APIs, Then none are used', () => {
    // Arrange
    const sut = sourceFiles('src')

    // Act
    const offences = sut.flatMap(file => {
      const content = readFileSync(file, 'utf8')
      return FORBIDDEN.flatMap(({ pattern, use }) =>
        [...content.matchAll(pattern)].map(
          match =>
            `${file}:${lineOf(content, match.index)} uses ${match[0]} — use ${use}`
        )
      )
    })

    // Assert
    expect(offences).toEqual([])
  })

  it('When it is scanned, Then the scan actually reached the source tree', () => {
    // Act
    const result = sourceFiles('src')

    // Assert — a silently empty walk would make the guard above vacuous.
    expect(result.length).toBeGreaterThan(50)
    expect(result).toContain(join('src', 'utils', 'changeSet.ts'))
  })
})
