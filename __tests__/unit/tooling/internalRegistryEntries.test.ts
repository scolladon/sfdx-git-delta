import { describe, expect, it } from 'vitest'

import { MetadataSchema } from '../../../src/schemas/metadata.ts'
import type { Metadata } from '../../../src/types/metadata.ts'
import {
  GAP_FILLER_FIELDS,
  isSimpleGapFiller,
  selectRemovableEntries,
  selectRetainedOverrides,
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
