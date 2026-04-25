'use strict'
import { PassThrough } from 'node:stream'

import { beforeAll, describe, expect, it } from 'vitest'

import type { Config } from '../../../../src/types/config'
import type { Manifest } from '../../../../src/types/work'
import PackageBuilder from '../../../../src/utils/packageHelper'

const buildToString = async (
  builder: PackageBuilder,
  manifest: Manifest
): Promise<string> => {
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
  await builder.buildPackageStream(manifest, stream)
  stream.end()
  return Buffer.concat(chunks).toString('utf8')
}

const config: Config = {
  apiVersion: 46,
  to: '',
  from: '',
  output: '',
  source: [''],
  ignore: '',
  ignoreDestructive: '',
  repo: '',
  ignoreWhitespace: false,
  generateDelta: false,
  include: '',
  includeDestructive: '',
}
const tests = [
  [
    'Object',
    new Map(
      Object.entries({
        CustomObject: new Set([
          'Object',
          'YetAnotherObject',
          'OtherObject',
          'AgainAnObject',
          'ÀgainAndAgainAnObject',
        ]),
      })
    ),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>ÀgainAndAgainAnObject</members>
        <members>AgainAnObject</members>
        <members>Object</members>
        <members>OtherObject</members>
        <members>YetAnotherObject</members>
        <name>CustomObject</name>
    </types>
    <version>${config.apiVersion}.0</version>
</Package>`,
  ],
  [
    'empty',
    new Map(),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>${config.apiVersion}.0</version>
</Package>`,
  ],
  [
    'full',
    new Map(
      Object.entries({
        CustomField: new Set(['Field']),
        CustomObject: new Set(['Object', 'YetAnotherObject', 'OtherObject']),
        Dashboard: new Set(['Dashboard']),
        Document: new Set(['Document']),
        LightningComponentBundle: new Set(['Component']),
        WaveLens: new Set(['Lens']),
        WaveRecipe: new Set(['Recipe']),
      })
    ),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Object</members>
        <members>OtherObject</members>
        <members>YetAnotherObject</members>
        <name>CustomObject</name>
    </types>
    <types>
        <members>Field</members>
        <name>CustomField</name>
    </types>
    <types>
        <members>Dashboard</members>
        <name>Dashboard</name>
    </types>
    <types>
        <members>Document</members>
        <name>Document</name>
    </types>
    <types>
        <members>Component</members>
        <name>LightningComponentBundle</name>
    </types>
    <types>
        <members>Lens</members>
        <name>WaveLens</name>
    </types>
    <types>
        <members>Recipe</members>
        <name>WaveRecipe</name>
    </types>
    <version>${config.apiVersion}.0</version>
</Package>`,
  ],
  [
    'WaveApplication',
    new Map([['WaveApplication', new Set(['aWaveApp'])]]),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>aWaveApp</members>
        <name>WaveApplication</name>
    </types>
    <version>${config.apiVersion}.0</version>
</Package>`,
  ],
]

describe('Given a PackageBuilder', () => {
  let sut: PackageBuilder
  beforeAll(async () => {
    sut = new PackageBuilder(config)
  })

  it.each(tests)('can build %s manifest', async (_, diff, expected) => {
    const out = await buildToString(sut, diff as Manifest)
    expect(out).toBe(expected)
  })

  describe('member sort order uses fr locale collation', () => {
    it('When members include accented chars (À), Then they sort before uppercase ASCII A under fr locale', async () => {
      // Arrange — 'À' (U+00C0) sorts before 'A' in French locale (fr)
      // because the primary letter is treated as 'A' and the accent is a
      // secondary difference that makes it sort first in fr collation.
      // If the locale string were mutated to '' the sort order could differ.
      const manifest = new Map([
        ['ApexClass', new Set(['Zebra', 'Alpha', 'ÀAccented', 'Beta'])],
      ])

      // Act
      const out = await buildToString(sut, manifest)

      // Assert — ÀAccented must appear before Alpha under fr collation
      const membersSection = out
        .split('<name>')[0]
        .split('<members>')
        .filter(Boolean)
        .map(s => s.split('</members>')[0].trim())
      const idxAccented = membersSection.indexOf('ÀAccented')
      const idxAlpha = membersSection.indexOf('Alpha')
      expect(idxAccented).toBeGreaterThanOrEqual(0)
      expect(idxAlpha).toBeGreaterThanOrEqual(0)
      expect(idxAccented).toBeLessThan(idxAlpha)
    })

    it('When types include CustomObject, Then it is sorted first regardless of locale', async () => {
      // Arrange — CustomObject must always be first because the comparator
      // special-cases it (x === OBJECT_TYPE → return -1).
      const manifest = new Map([
        ['ApexClass', new Set(['Foo'])],
        ['CustomObject', new Set(['Bar'])],
        ['Workflow', new Set(['Baz'])],
      ])

      // Act
      const out = await buildToString(sut, manifest)

      // Assert — CustomObject block comes before ApexClass block
      const customObjectIdx = out.indexOf('<name>CustomObject</name>')
      const apexClassIdx = out.indexOf('<name>ApexClass</name>')
      expect(customObjectIdx).toBeLessThan(apexClassIdx)
    })
  })
})
