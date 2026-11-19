import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import internalRegistry from '../../../src/metadata/internalRegistry.ts'
import type { Metadata } from '../../../src/types/metadata.ts'
import { isSimpleGapFiller } from '../../../tooling/internalRegistryEntries.ts'
import {
  GAP_FILLER_SECTION_HEADER,
  removeEntries,
} from '../../../tooling/internalRegistrySource.ts'

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

// Real-file lens stays linear in the gap-filler count; the exhaustive subset
// sweep runs on the fixed synthetic source below.
const linearSelectionsOf = (indices: readonly number[]) => [
  [],
  ...indices.map(index => [index]),
  indices,
]

const assertRemovalInvariants = (
  source: string,
  result: string,
  entries: readonly Metadata[],
  removedIndices: readonly number[]
) => {
  const sourceLines = source.split('\n')
  const removedNames = removedIndices.map(i => entries[i]!.xmlName!)
  const removedLength = removedNames
    .map(name => spanLength(sourceLines, name))
    .reduce((sum, length) => sum + length, 0)
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

  describe('When none, each one, or all of the allow-list-simple entries are removed', () => {
    const simpleIndices = internalRegistry.flatMap((entry, index) =>
      isSimpleGapFiller(entry) ? [index] : []
    )

    it.each(
      linearSelectionsOf(simpleIndices).map(selection => ({
        label: selection.join(',') || 'none',
        selection,
      }))
    )(
      'Then only those spans go and comments stay ($label)',
      ({ selection }) => {
        // Arrange
        const sut = removeEntries

        // Act
        const result = sut(source, internalRegistry, new Set(selection))

        // Assert
        assertRemovalInvariants(source, result, internalRegistry, selection)
      }
    )
  })
})

describe('Given the gap-filler section header above the first entry', () => {
  const source = sourceOf(
    GAP_FILLER_SECTION_HEADER,
    spanLines('First'),
    spanLines('Second')
  )
  const entries = entriesOf('First', 'Second')

  describe('When that first entry is removed', () => {
    it("Then the header stays and the entry's lines are gone", () => {
      // Arrange
      const sut = removeEntries

      // Act
      const result = sut(source, entries, new Set([0]))

      // Assert
      expect(result).toBe(
        sourceOf(GAP_FILLER_SECTION_HEADER, spanLines('Second'))
      )
    })
  })
})

describe('Given an entry with its own comment above it', () => {
  describe('When that entry is removable', () => {
    it.each([
      { label: 'one line', comment: ['  // why First exists'] },
      {
        label: 'as many lines as the header',
        comment: ['  // why First exists', '  // and more'],
      },
      {
        label: 'the header plus an own line',
        comment: [...GAP_FILLER_SECTION_HEADER, '  // why First exists'],
      },
      {
        label: 'an own line plus the header',
        comment: ['  // why First exists', ...GAP_FILLER_SECTION_HEADER],
      },
      {
        label: 'the first header line only',
        comment: GAP_FILLER_SECTION_HEADER.slice(0, 1),
      },
      {
        label: 'the header with an edited second line',
        comment: [...GAP_FILLER_SECTION_HEADER.slice(0, 1), '  // edited'],
      },
      {
        label: 'the header re-indented',
        comment: GAP_FILLER_SECTION_HEADER.map(line => ` ${line}`),
      },
    ])('Then it throws naming the entry ($label)', ({ comment }) => {
      // Arrange
      const sut = removeEntries
      const source = sourceOf(comment, spanLines('First'))

      // Act & Assert
      expect(() => sut(source, entriesOf('First'), new Set([0]))).toThrow(
        /entry 0 \('First'\) is removable but has its own comment above it/
      )
    })
  })

  describe('When another entry is removed', () => {
    it('Then the commented entry and its comment stay', () => {
      // Arrange
      const sut = removeEntries
      const commented = [['  // why First exists'], spanLines('First')]
      const source = sourceOf(...commented, spanLines('Second'))

      // Act
      const result = sut(source, entriesOf('First', 'Second'), new Set([1]))

      // Assert
      expect(result).toBe(sourceOf(...commented))
    })
  })
})

describe('Given a stray opener before a complete entry', () => {
  const source = sourceOf(['  {'], spanLines('First'))

  describe('When the entry is removed', () => {
    it('Then the span starts at the last opener and the stray line stays', () => {
      // Arrange
      const sut = removeEntries

      // Act
      const result = sut(source, entriesOf('First'), new Set([0]))

      // Assert
      expect(result).toBe(sourceOf(['  {']))
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
    GAP_FILLER_SECTION_HEADER,
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
      const sut = removeEntries

      // Act
      const result = sut(source, entries, new Set(subset))

      // Assert
      assertRemovalInvariants(source, result, entries, subset)
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
      expect(() => sut(source, entriesOf('First', 'Open'), new Set())).toThrow(
        /1 entry spans but exports 2 entries/
      )
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
    it('Then it throws naming the line endings', () => {
      // Arrange
      const sut = removeEntries
      const source = sourceOf(spanLines('First')).split('\n').join('\r\n')

      // Act & Assert
      expect(() => sut(source, entriesOf('First'), new Set([0]))).toThrow(
        /uses CRLF line endings/
      )
    })
  })
})

describe('Given xmlName present on only one side', () => {
  const unnamed = ['  {', "    directoryName: 'widgets',", '  },']

  describe('When the source span has no xmlName line but the entry has one', () => {
    it('Then it throws pointing at the formatting', () => {
      // Arrange
      const sut = removeEntries
      const source = sourceOf(spanLines('First'), unnamed)

      // Act & Assert
      expect(() =>
        sut(source, entriesOf('First', 'Expected'), new Set())
      ).toThrow(
        /entry 1: expected xmlName 'Expected', found 'undefined'; keep entries Biome-formatted/
      )
    })
  })

  describe('When the source span has an xmlName but the entry has none', () => {
    it('Then it throws naming the found xmlName', () => {
      // Arrange
      const sut = removeEntries
      const source = sourceOf(spanLines('First'), spanLines('Found'))
      const entries = [
        buildEntry('First'),
        { directoryName: 'widgets' } as Metadata,
      ]

      // Act & Assert
      expect(() => sut(source, entries, new Set())).toThrow(
        /entry 1: expected xmlName 'undefined', found 'Found'/
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

describe('Given an xmlName line sitting right above the opener of an entry without xmlName', () => {
  const source = sourceOf(
    ["    xmlName: 'Outside',"],
    ['  {', "    directoryName: 'widgets',", '  },']
  )
  const entries = [{ directoryName: 'widgets' }] as Metadata[]

  describe('When the entries are checked against the source', () => {
    it('Then the line outside the span is not read as the entry xmlName', () => {
      // Arrange
      const sut = removeEntries

      // Act
      const result = sut(source, entries, new Set())

      // Assert
      expect(result).toBe(source)
    })
  })
})

describe('Given an entry whose xmlName is empty', () => {
  const source = sourceOf(spanLines(''), spanLines('Second'))

  describe('When the entries are checked against the source', () => {
    it('Then the empty xmlName is read from its line', () => {
      // Arrange
      const sut = removeEntries

      // Act
      const result = sut(source, entriesOf('', 'Second'), new Set([1]))

      // Assert
      expect(result).toBe(sourceOf(spanLines('')))
    })
  })
})

describe('Given a code line with a trailing comment right above a removable entry', () => {
  const source = [
    'export default [ // registry',
    ...spanLines('First'),
    ...FOOTER,
  ].join('\n')

  describe('When that entry is removed', () => {
    it('Then the trailing comment is not taken for an own comment', () => {
      // Arrange
      const sut = removeEntries

      // Act
      const result = sut(source, entriesOf('First'), new Set([0]))

      // Assert
      expect(result).toBe(
        ['export default [ // registry', ...FOOTER].join('\n')
      )
    })
  })
})

describe('Given an xmlName line with trailing characters', () => {
  const source = sourceOf([
    '  {',
    "    directoryName: 'widgets',",
    "    xmlName: 'First', // note",
    '  },',
  ])

  describe('When the entries are checked against the source', () => {
    it('Then the line is not read as the entry xmlName', () => {
      // Arrange
      const sut = removeEntries

      // Act & Assert
      expect(() => sut(source, entriesOf('First'), new Set())).toThrow(
        /found 'undefined'/
      )
    })
  })
})
