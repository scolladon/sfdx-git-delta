import { describe, expect, it } from 'vitest'

import type { Metadata } from '../../../src/types/metadata.ts'
import {
  categorize,
  isSimpleGapFiller,
  serializeEntry,
} from '../../../tooling/internalRegistryEntries.ts'

const buildEntry = (overrides: Partial<Metadata> = {}): Metadata => ({
  directoryName: 'widgets',
  inFolder: false,
  metaFile: false,
  ...overrides,
})

// The committed registry is asserted `as Metadata[]`, so its child entries
// (Profile and Translations children) reach these functions with no
// directoryName although the type declares it required.
const buildEntryWithoutDirectory = (
  overrides: Partial<Metadata> = {}
): Metadata => {
  const { directoryName: _absent, ...entry } = buildEntry(overrides)
  return entry as Metadata
}

const lines = (...body: readonly string[]): string =>
  ['  {', ...body, '  },'].join('\n')

describe('Given a registry entry to serialize', () => {
  describe('When every field is populated', () => {
    it('Then fields render in the generated file order, strings quoted and booleans bare', () => {
      const sut = serializeEntry
      const entry = buildEntry({
        xmlTag: 'widgetTag',
        xmlName: 'Widget',
        suffix: 'widget',
        pruneOnly: true,
        parentXmlName: 'Gadget',
        metaFile: true,
        key: 'fullName',
        inFolder: true,
        excluded: true,
        directoryName: 'widgets',
        content: [{ suffix: 'part', xmlName: 'WidgetPart' }],
        childXmlNames: ['WidgetChild', 'WidgetOther'],
      })

      const result = sut(entry)

      expect(result).toBe(
        lines(
          "    childXmlNames: ['WidgetChild', 'WidgetOther'],",
          '    content: [',
          '      {',
          "        suffix: 'part',",
          "        xmlName: 'WidgetPart',",
          '      },',
          '    ],',
          "    directoryName: 'widgets',",
          '    excluded: true,',
          '    inFolder: true,',
          "    key: 'fullName',",
          '    metaFile: true,',
          "    parentXmlName: 'Gadget',",
          '    pruneOnly: true,',
          "    suffix: 'widget',",
          "    xmlName: 'Widget',",
          "    xmlTag: 'widgetTag',"
        )
      )
    })
  })

  describe('When only the required fields are present', () => {
    it('Then only directoryName, inFolder and metaFile render', () => {
      const sut = serializeEntry

      const result = sut(buildEntry())

      expect(result).toBe(
        lines(
          "    directoryName: 'widgets',",
          '    inFolder: false,',
          '    metaFile: false,'
        )
      )
    })
  })

  describe('When the truthiness-gated fields hold falsy values', () => {
    it('Then excluded, key, parentXmlName, pruneOnly, suffix and xmlName are omitted', () => {
      const sut = serializeEntry
      const entry = buildEntry({
        excluded: false,
        key: '',
        parentXmlName: '',
        pruneOnly: false,
        suffix: '',
        xmlName: '',
      })

      const result = sut(entry)

      expect(result).toBe(
        lines(
          "    directoryName: 'widgets',",
          '    inFolder: false,',
          '    metaFile: false,'
        )
      )
    })
  })

  describe('When directoryName is absent', () => {
    it('Then the directoryName line is omitted', () => {
      const sut = serializeEntry

      const result = sut(buildEntryWithoutDirectory())

      expect(result).toBe(lines('    inFolder: false,', '    metaFile: false,'))
    })
  })

  describe('When directoryName and xmlTag are empty strings', () => {
    it('Then both still render as quoted empty strings', () => {
      const sut = serializeEntry
      const entry = buildEntry({ directoryName: '', xmlTag: '' })

      const result = sut(entry)

      expect(result).toBe(
        lines(
          "    directoryName: '',",
          '    inFolder: false,',
          '    metaFile: false,',
          "    xmlTag: '',"
        )
      )
    })
  })

  describe('When content items lack a suffix or an xmlName', () => {
    it('Then each item renders its own braces with only its present sub-fields', () => {
      const sut = serializeEntry
      const entry = buildEntry({
        content: [{ suffix: 'part' }, { xmlName: 'WidgetPart' }, {}],
      })

      const result = sut(entry)

      expect(result).toBe(
        lines(
          '    content: [',
          '      {',
          "        suffix: 'part',",
          '      },',
          '      {',
          "        xmlName: 'WidgetPart',",
          '      },',
          '      {',
          '      },',
          '    ],',
          "    directoryName: 'widgets',",
          '    inFolder: false,',
          '    metaFile: false,'
        )
      )
    })
  })

  describe('When content and childXmlNames are empty arrays', () => {
    it('Then both render as empty brackets', () => {
      const sut = serializeEntry
      const entry = buildEntry({ content: [], childXmlNames: [] })

      const result = sut(entry)

      expect(result).toBe(
        lines(
          '    childXmlNames: [],',
          '    content: [',
          '    ],',
          "    directoryName: 'widgets',",
          '    inFolder: false,',
          '    metaFile: false,'
        )
      )
    })
  })
})

describe('Given a registry entry to classify as a simple gap-filler', () => {
  describe('When it has a directoryName and a suffix and no special field', () => {
    it('Then it is a simple gap-filler', () => {
      const sut = isSimpleGapFiller

      const result = sut(buildEntry({ suffix: 'widget', xmlName: 'Widget' }))

      expect(result).toBe(true)
    })
  })

  describe('When the directoryName is absent', () => {
    it('Then it is not a simple gap-filler', () => {
      const sut = isSimpleGapFiller

      const result = sut(buildEntryWithoutDirectory({ suffix: 'widget' }))

      expect(result).toBe(false)
    })
  })

  describe('When the suffix is absent', () => {
    it('Then it is not a simple gap-filler', () => {
      const sut = isSimpleGapFiller

      const result = sut(buildEntry())

      expect(result).toBe(false)
    })
  })

  describe.each<[string, Partial<Metadata>]>([
    ['xmlTag', { xmlTag: '' }],
    ['key', { key: '' }],
    ['content', { content: [] }],
    ['excluded', { excluded: false }],
    ['pruneOnly', { pruneOnly: false }],
    ['parentXmlName', { parentXmlName: '' }],
    ['childXmlNames', { childXmlNames: [] }],
  ])(
    'When the special field %s is set, even to a falsy value',
    (_field, special) => {
      it('Then it is not a simple gap-filler', () => {
        const sut = isSimpleGapFiller

        const result = sut(buildEntry({ suffix: 'widget', ...special }))

        expect(result).toBe(false)
      })
    }
  )
})

describe('Given a registry entry to categorize', () => {
  describe.each<[string, Partial<Metadata>, string]>([
    ['an xmlName prefixed Virtual', { xmlName: 'VirtualWidget' }, 'virtual'],
    ['a content list', { content: [], pruneOnly: true }, 'virtual'],
    ['pruneOnly', { pruneOnly: true, parentXmlName: 'Profile' }, 'pruneOnly'],
    ['a Profile parent', { parentXmlName: 'Profile' }, 'profileChildren'],
    [
      'a Translations parent',
      { parentXmlName: 'Translations' },
      'translationsChildren',
    ],
    [
      'a MarketingAppExtension parent',
      { parentXmlName: 'MarketingAppExtension' },
      'marketingAppExt',
    ],
    [
      'a GlobalValueSetTranslation parent',
      { parentXmlName: 'GlobalValueSetTranslation' },
      'valueTranslation',
    ],
    [
      'the CustomLabel xmlName on a gap-filler shape',
      { xmlName: 'CustomLabel', suffix: 'label' },
      'specialHandling',
    ],
    [
      'the CustomFieldTranslation xmlName on a gap-filler shape',
      { xmlName: 'CustomFieldTranslation', suffix: 'fieldTranslation' },
      'specialHandling',
    ],
    [
      'the CustomObjectTranslation xmlName on a gap-filler shape',
      { xmlName: 'CustomObjectTranslation', suffix: 'objectTranslation' },
      'specialHandling',
    ],
    ['a simple gap-filler shape', { suffix: 'widget' }, 'gapFiller'],
    ['no distinguishing field', {}, 'specialHandling'],
  ])('When it has %s', (_label, overrides, expected) => {
    it(`Then it lands in ${expected}`, () => {
      const sut = categorize

      const result = sut(buildEntry(overrides))

      expect(result).toBe(expected)
    })
  })
})
