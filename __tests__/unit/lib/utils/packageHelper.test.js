'use strict'
const PackageBuilder = require('../../../../src/utils/packageHelper')
const {
  fillPackageWithParameter,
} = require('../../../../src/utils/packageHelper')

const options = { apiVersion: '46' }
const tests = [
  [
    'Object',
    new Map(
      Object.entries({
        objects: new Set([
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
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
  [
    'empty',
    new Map(),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
  [
    'full',
    new Map(
      Object.entries({
        dashboards: new Set(['Dashboard']),
        documents: new Set(['Document']),
        fields: new Set(['Field']),
        lwc: new Set(['Component']),
        objects: new Set(['Object', 'YetAnotherObject', 'OtherObject']),
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
    <version>${options.apiVersion}.0</version>
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
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
]

describe(`test if package builder`, () => {
  let globalMetadata
  let packageConstructor
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
    packageConstructor = new PackageBuilder(options, globalMetadata)
  })

  test.each(tests)(
    'can build %s destructiveChanges.xml',
    (type, diff, expected) => {
      expect(packageConstructor.buildPackage(diff)).toBe(expected)
    }
  )
  test('can handle null diff', () => {
    expect(packageConstructor.buildPackage(null)).toBe(undefined)
  })
})

describe('fillPackageWithParameter', () => {
  describe('when called with proper params', () => {
    const type = 'test-type'
    const elementName = 'test-name'
    describe.each([
      [new Map(), 'is empty'],
      [new Map([['other-type', new Set(['other-name'])]]), 'is not empty'],
      [new Map([[type, new Set()]]), 'contains the type'],
      [
        new Map([[type, new Set([elementName])]]),
        'contains the type and the element',
      ],
    ])('when the package %o  %s', pack => {
      it('adds the element name under the type in the package', () => {
        // Arrange
        const params = {
          package: pack,
          type: type,
          elementName: elementName,
        }

        // Act
        fillPackageWithParameter(params)

        // Assert
        expect(pack.get(type).has(elementName)).toBeTruthy()
      })
    })
  })

  describe('when called with bad parameter', () => {
    describe.each([
      undefined,
      {
        package: {},
        type: [],
        elementName: new Set(),
      },
      {
        piquouze: new Map(),
        top: 'top',
        elementary: 'elementary',
      },
    ])('when called with %o', params => {
      it('should fail', () => {
        // Act
        try {
          fillPackageWithParameter(params)
        } catch (ex) {
          // Assert
          expect(ex).toBeTruthy()
        }
      })
    })
  })
})
