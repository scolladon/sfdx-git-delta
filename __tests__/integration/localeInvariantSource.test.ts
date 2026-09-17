'use strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// sgd's manifests are a deployment artifact: the same repository at the same
// commits must produce the same bytes on every machine. APIs that read the
// HOST DEFAULT locale silently make that untrue — a Turkish host folds 'I' to
// a dotless 'ı', and ICU collation tailorings order even pure-ASCII names
// differently. Guarding the source rather than a single call site is what
// keeps the next one from being written.
//
// An explicitly pinned locale is the sanctioned escape hatch and is not
// flagged: packageHelper builds its package.xml member collator with one on
// purpose, so its ordering is a deliberate choice rather than a property of
// whoever ran the command.
const FORBIDDEN = [
  { pattern: /\.toLocaleLowerCase\(/g, use: 'toLowerCase()' },
  { pattern: /\.toLocaleUpperCase\(/g, use: 'toUpperCase()' },
  {
    pattern: /\.toLocale(String|DateString|TimeString)\(/g,
    use: 'an ISO rendering, or the toLocale* form with an explicit locale',
  },
  {
    pattern: /\.localeCompare\([^,)]*\)/g,
    use: 'a code-unit comparison, or localeCompare with an explicit locale',
  },
  {
    pattern: /\.localeCompare\([^)]*,\s*undefined\s*[,)]/g,
    use: 'localeCompare with an explicit locale instead of undefined',
  },
  {
    pattern: /new Intl\.\w+\(\s*(undefined\s*)?[,)]/g,
    use: 'the same Intl constructor with an explicitly pinned locale',
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
  it('When it is scanned for host-default-locale APIs, Then none are used', () => {
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
