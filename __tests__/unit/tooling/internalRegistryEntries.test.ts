import { describe, expect, it } from 'vitest'

import { MetadataSchema } from '../../../src/schemas/metadata.ts'
import type { Metadata } from '../../../src/types/metadata.ts'
import {
  categorize,
  GAP_FILLER_FIELDS,
  isSimpleGapFiller,
  type RegistryCategory,
  selectRemovableEntries,
  selectRetainedOverrides,
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

// Every schema field with a sample value; the guard below keeps it in step
// with MetadataSchema so a new field cannot skip the table.
const FIELD_SAMPLES: Readonly<Record<keyof Metadata, unknown>> = {
  suffix: 'widget',
  xmlName: 'Widget',
  directoryName: 'widgets',
  inFolder: false,
  metaFile: false,
  content: [],
  parentXmlName: '',
  xmlTag: '',
  key: '',
  excluded: false,
  pruneOnly: false,
  childXmlNames: [],
  adapter: '',
  decomposition: '',
}
const NON_GAP_FILLER_SAMPLES = Object.entries(FIELD_SAMPLES).filter(
  ([field]) => !GAP_FILLER_FIELDS.has(field)
)

const lines = (...body: readonly string[]): string =>
  ['  {', ...body, '  },'].join('\n')

describe('Given a registry entry to serialize', () => {
  describe('When every field it serializes is populated', () => {
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

  describe.each(NON_GAP_FILLER_SAMPLES)(
    'When the non-gap-filler field %s is present, even as an empty or false value',
    (field, sample) => {
      it('Then it is not a simple gap-filler', () => {
        const sut = isSimpleGapFiller

        const result = sut({
          ...buildEntry({ suffix: 'widget' }),
          [field]: sample,
        } as Metadata)

        expect(result).toBe(false)
      })
    }
  )

  describe('When a non-gap-filler field is present with an explicit undefined value', () => {
    it('Then it is not a simple gap-filler', () => {
      const sut = isSimpleGapFiller

      const result = sut({
        ...buildEntry({ suffix: 'widget' }),
        key: undefined,
      } as Metadata)

      expect(result).toBe(false)
    })
  })
})

describe('Given the gap-filler allow-list', () => {
  describe('When compared with MetadataSchema', () => {
    it('Then every allow-listed field is a schema field', () => {
      const schemaFields = Object.keys(MetadataSchema.shape)

      const result = [...GAP_FILLER_FIELDS]

      expect(schemaFields).toEqual(expect.arrayContaining(result))
    })

    it('Then FIELD_SAMPLES covers exactly the schema fields', () => {
      const result = Object.keys(FIELD_SAMPLES).sort()

      expect(result).toEqual(Object.keys(MetadataSchema.shape).sort())
    })
  })
})

describe('Given registry entries and the xmlNames SDR knows', () => {
  const sdrXmlNames = new Set(['Widget', 'Gadget', 'Doohickey'])

  describe('When selecting the removable entries', () => {
    it('Then an SDR-known simple gap-filler is returned by index', () => {
      const sut = selectRemovableEntries

      const result = sut(
        [buildEntry({ suffix: 'widget', xmlName: 'Widget' })],
        sdrXmlNames
      )

      expect(result).toEqual(new Set([0]))
    })

    it('Then an SDR-unknown simple gap-filler is not returned', () => {
      const sut = selectRemovableEntries

      const result = sut(
        [buildEntry({ suffix: 'zip', xmlName: 'Zip' })],
        sdrXmlNames
      )

      expect(result).toEqual(new Set())
    })

    it.each([
      ['adapter', { adapter: 'bundle' }],
      ['decomposition', { decomposition: 'probeOverride' }],
    ] as const)(
      'Then an SDR-known entry carrying %s is not returned',
      (_f, extra) => {
        const sut = selectRemovableEntries

        const result = sut(
          [buildEntry({ suffix: 'widget', xmlName: 'Widget', ...extra })],
          sdrXmlNames
        )

        expect(result).toEqual(new Set())
      }
    )

    it('Then a simple gap-filler without an xmlName is not returned', () => {
      const sut = selectRemovableEntries

      const result = sut([buildEntry({ suffix: 'widget' })], sdrXmlNames)

      expect(result).toEqual(new Set())
    })

    it('Then only the qualifying entry among entries sharing an xmlName is returned', () => {
      const sut = selectRemovableEntries

      const result = sut(
        [
          buildEntry({ suffix: 'widget', xmlName: 'Widget', key: 'fullName' }),
          buildEntry({ suffix: 'widget', xmlName: 'Widget' }),
        ],
        sdrXmlNames
      )

      expect(result).toEqual(new Set([1]))
    })
  })

  describe('When selecting the retained overrides', () => {
    it('Then SDR-known non-gap-fillers are listed in source order', () => {
      const sut = selectRetainedOverrides

      const result = sut(
        [
          buildEntry({ suffix: 'widget', xmlName: 'Widget' }),
          buildEntry({
            suffix: 'gadget',
            xmlName: 'Gadget',
            adapter: 'bundle',
          }),
          buildEntry({ suffix: 'gizmo', xmlName: 'Gizmo', key: 'fullName' }),
          buildEntry({
            suffix: 'dh',
            xmlName: 'Doohickey',
            decomposition: 'folderPerType',
          }),
        ],
        sdrXmlNames
      )

      expect(result).toEqual(['Gadget', 'Doohickey'])
    })

    it('Then nothing is listed when every entry is a simple gap-filler', () => {
      const sut = selectRetainedOverrides

      const result = sut(
        [buildEntry({ suffix: 'widget', xmlName: 'Widget' })],
        sdrXmlNames
      )

      expect(result).toEqual([])
    })
  })
})

describe('Given a registry entry to categorize', () => {
  describe.each<[string, Partial<Metadata>, RegistryCategory]>([
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
