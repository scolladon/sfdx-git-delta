import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import internalRegistry from '../../../src/metadata/internalRegistry.ts'
import type { Metadata } from '../../../src/types/metadata.ts'
import { isSimpleGapFiller } from '../../../tooling/internalRegistryEntries.ts'
import { removeEntries } from '../../../tooling/internalRegistrySource.ts'

const REGISTRY_PATH = fileURLToPath(
  new URL('../../../src/metadata/internalRegistry.ts', import.meta.url)
)
const HEADER = [
  "import type { Metadata } from '../types/metadata.js'",
  '',
  'export default [',
]
const FOOTER = ['] as Metadata[]', '']
const COMMENT_LINE = /^\s*\/\//

const spanLines = (xmlName: string, ...extra: readonly string[]) => [
  '  {',
  "    directoryName: 'widgets',",
  '    inFolder: false,',
  '    metaFile: false,',
  ...extra,
  `    xmlName: '${xmlName}',`,
  '  },',
]
const sourceOf = (...body: readonly (readonly string[])[]) =>
  [...HEADER, ...body.flat(), ...FOOTER].join('\n')

const buildEntry = (xmlName: string, overrides: Partial<Metadata> = {}) =>
  ({
    directoryName: 'widgets',
    inFolder: false,
    metaFile: false,
    xmlName,
    ...overrides,
  }) as Metadata

const entriesOf = (...names: readonly string[]) =>
  names.map(name => buildEntry(name))

// Anchor-based oracle, independent of the module's opener/closer scan.
const spanLength = (lines: readonly string[], xmlName: string) => {
  const at = lines.indexOf(`    xmlName: '${xmlName}',`)
  const start = lines.lastIndexOf('  {', at)
  const end = lines.indexOf('  },', at)
  return end - start + 1
}

const subsetsOf = (indices: readonly number[]) =>
  Array.from({ length: 2 ** indices.length }, (_, mask) =>
    indices.filter((_, bit) => mask & (1 << bit))
  )

const commentsOf = (lines: readonly string[]) =>
  lines.filter(line => COMMENT_LINE.test(line))

const expectRemovalInvariants = (
  source: string,
  entries: readonly Metadata[],
  removedIndices: readonly number[]
) => {
  const sourceLines = source.split('\n')
  const removedNames = removedIndices.map(i => entries[i]!.xmlName!)
  const removedLength = removedNames
    .map(name => spanLength(sourceLines, name))
    .reduce((sum, length) => sum + length, 0)

  const result = removeEntries(source, entries, new Set(removedIndices))

  const resultLines = result.split('\n')
  expect(resultLines).toHaveLength(sourceLines.length - removedLength)
  expect(commentsOf(resultLines)).toEqual(commentsOf(sourceLines))
  for (const name of removedNames) {
    expect(resultLines).not.toContain(`    xmlName: '${name}',`)
  }
  for (const entry of entries.filter((_, i) => !removedIndices.includes(i))) {
    expect(resultLines).toContain(`    xmlName: '${entry.xmlName}',`)
  }
}

describe('removeEntries', () => {
  describe('Given the committed internal registry source and its module', () => {
    const source = readFileSync(REGISTRY_PATH, 'utf8')

    describe('When no entry is removable', () => {
      it('Then the output is byte-identical to the source', () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, internalRegistry, new Set())

        // Assert
        expect(result).toBe(source)
      })
    })

    describe('When any subset of the allow-list-simple entries is removed', () => {
      const simpleIndices = internalRegistry.flatMap((entry, index) =>
        isSimpleGapFiller(entry) ? [index] : []
      )

      it.each(
        subsetsOf(simpleIndices).map(subset => ({
          label: subset.join(',') || 'none',
          subset,
        }))
      )('Then only those spans go and comments stay ($label)', ({ subset }) => {
        // Arrange
        const sut = expectRemovalInvariants

        // Act & Assert
        sut(source, internalRegistry, subset)
      })
    })
  })

  describe('Given a source with a section header comment above the first entry', () => {
    const source = sourceOf(
      ['  // section header'],
      spanLines('First'),
      spanLines('Second')
    )
    const entries = entriesOf('First', 'Second')

    describe('When that first entry is removed', () => {
      it("Then the header comment stays and the entry's lines are gone", () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, entries, new Set([0]))

        // Assert
        expect(result).toBe(
          sourceOf(['  // section header'], spanLines('Second'))
        )
      })
    })
  })

  describe('Given a source whose last entry precedes the footer', () => {
    const source = sourceOf(spanLines('First'), spanLines('Last'))

    describe('When the last entry is removed', () => {
      it('Then the footer is kept', () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, entriesOf('First', 'Last'), new Set([1]))

        // Assert
        expect(result).toBe(sourceOf(spanLines('First')))
      })
    })
  })

  describe('Given entries carrying adapter and decomposition next to a simple one', () => {
    const adapterSpan = spanLines('WithAdapter', "    adapter: 'bundle',")
    const decompositionSpan = spanLines(
      'WithDecomposition',
      "    decomposition: 'probeOverride',"
    )
    const source = sourceOf(adapterSpan, spanLines('Simple'), decompositionSpan)
    const entries = entriesOf('WithAdapter', 'Simple', 'WithDecomposition')

    describe('When only the simple entry is removed', () => {
      it('Then the other two entries survive verbatim', () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, entries, new Set([1]))

        // Assert
        expect(result).toBe(sourceOf(adapterSpan, decompositionSpan))
      })
    })
  })

  describe('Given two entries sharing the same xmlName', () => {
    const source = sourceOf(spanLines('Widget'), spanLines('Widget'))
    const entries = entriesOf('Widget', 'Widget')

    describe('When the second one is removable', () => {
      it('Then only the second span goes', () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, entries, new Set([1]))

        // Assert
        expect(result).toBe(sourceOf(spanLines('Widget')))
      })
    })
  })

  describe('Given three synthetic gap-fillers between a comment and an adapter entry', () => {
    const body = [
      ['  // gap fillers'],
      spanLines('GapA'),
      spanLines('GapB'),
      spanLines('GapC'),
      spanLines('Adapted', "    adapter: 'bundle',"),
    ]
    const source = sourceOf(...body)
    const entries = [
      ...entriesOf('GapA', 'GapB', 'GapC'),
      buildEntry('Adapted', { adapter: 'bundle' }),
    ]

    describe('When any subset of the gap-fillers is removed', () => {
      it.each(
        subsetsOf([0, 1, 2]).map(subset => ({
          label: subset.join(',') || 'none',
          subset,
        }))
      )('Then the invariants hold ($label)', ({ subset }) => {
        // Arrange
        const sut = expectRemovalInvariants

        // Act & Assert
        sut(source, entries, subset)
      })
    })
  })

  describe('Given an entry without xmlName in source and module', () => {
    const noName = ['  {', "    directoryName: 'widgets',", '  },']
    const source = sourceOf(noName, spanLines('Named'))
    const entries = [
      { directoryName: 'widgets' } as Metadata,
      buildEntry('Named'),
    ]

    describe('When it is removed', () => {
      it('Then it maps and can be removed', () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, entries, new Set([0]))

        // Assert
        expect(result).toBe(sourceOf(spanLines('Named')))
      })
    })
  })

  describe('Given an entry holding a nested content list', () => {
    const nested = [
      '  {',
      '    content: [',
      '      {',
      "        xmlName: 'Child',",
      '      },',
      '    ],',
      "    xmlName: 'Parent',",
      '  },',
    ]
    const source = sourceOf(nested, spanLines('After'))
    const entries = entriesOf('Parent', 'After')

    describe('When it is removed', () => {
      it('Then the nested objects are not counted and the whole block goes', () => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, entries, new Set([0]))

        // Assert
        expect(result).toBe(sourceOf(spanLines('After')))
      })
    })
  })

  describe('Given a source whose entry spans do not match the module', () => {
    const inline =
      "  { directoryName: 'x', inFolder: false, metaFile: false, xmlName: 'Inline' },"

    describe('When an entry is written inline', () => {
      it('Then it throws naming both counts', () => {
        // Arrange
        const sut = removeEntries
        const source = sourceOf(spanLines('First'), [inline])

        // Act & Assert
        expect(() =>
          sut(source, entriesOf('First', 'Inline'), new Set())
        ).toThrow(/1 entry spans but exports 2 entries/)
      })
    })

    describe('When a span is unterminated', () => {
      it('Then it throws naming both counts', () => {
        // Arrange
        const sut = removeEntries
        const source = sourceOf(spanLines('First'), ['  {'])

        // Act & Assert
        expect(() =>
          sut(source, entriesOf('First', 'Open'), new Set())
        ).toThrow(/1 entry spans but exports 2 entries/)
      })
    })

    describe('When a closer has no opener', () => {
      it('Then it throws naming both counts', () => {
        // Arrange
        const sut = removeEntries
        const source = sourceOf(spanLines('First'), ['  },'])

        // Act & Assert
        expect(() =>
          sut(source, entriesOf('First', 'Missing'), new Set())
        ).toThrow(/1 entry spans but exports 2 entries/)
      })
    })

    describe('When the source uses CRLF line endings', () => {
      it('Then it throws instead of editing', () => {
        // Arrange
        const sut = removeEntries
        const source = sourceOf(spanLines('First')).split('\n').join('\r\n')

        // Act & Assert
        expect(() => sut(source, entriesOf('First'), new Set([0]))).toThrow(
          /0 entry spans but exports 1 entries/
        )
      })
    })
  })

  describe('Given a source and a module that disagree on an xmlName', () => {
    const source = sourceOf(spanLines('First'), spanLines('Found'))
    const entries = entriesOf('First', 'Expected')

    describe('When the xmlName at index 1 differs', () => {
      it('Then it throws naming the index, the expected and the found xmlName', () => {
        // Arrange
        const sut = removeEntries

        // Act & Assert
        expect(() => sut(source, entries, new Set([0]))).toThrow(
          /entry 1: expected xmlName 'Expected', found 'Found'/
        )
      })
    })

    describe('When nothing is removable', () => {
      it('Then it still throws', () => {
        // Arrange
        const sut = removeEntries

        // Act & Assert
        expect(() => sut(source, entries, new Set())).toThrow(/entry 1/)
      })
    })
  })
})
