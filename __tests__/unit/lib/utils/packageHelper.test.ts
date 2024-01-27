'use strict'
import { expect, describe, it } from '@jest/globals'

import { Config } from '../../../../src/types/config'
import { Manifest } from '../../../../src/types/work'
import PackageBuilder, {
  fillPackageWithParameter,
} from '../../../../src/utils/packageHelper'

const config: Config = {
  apiVersion: 46,
  to: '',
  from: '',
  output: '',
  source: '',
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

describe(`test if package builder`, () => {
  let packageConstructor: PackageBuilder
  beforeAll(async () => {
    packageConstructor = new PackageBuilder(config)
  })

  it.each(tests)('can build %s manifest', (_, diff, expected) => {
    expect(packageConstructor.buildPackage(diff as Manifest)).toBe(expected)
  })
})

describe('fillPackageWithParameter', () => {
  describe('when called with proper params', () => {
    const type = 'test-type'
    const member = 'test-name'
    describe.each([
      [new Map(), 'is empty'],
      [new Map([['other-type', new Set(['other-name'])]]), 'is not empty'],
      [new Map([[type, new Set()]]), 'contains the type'],
      [
        new Map([[type, new Set([member])]]),
        'contains the type and the element',
      ],
    ])('when the package %o  %s', store => {
      it('adds the element name under the type in the package', () => {
        // Arrange
        const params = {
          store,
          type: type,
          member,
        }

        // Act
        fillPackageWithParameter(params)

        // Assert
        expect(store.get(type).has(member)).toBeTruthy()
      })
    })
  })
})
