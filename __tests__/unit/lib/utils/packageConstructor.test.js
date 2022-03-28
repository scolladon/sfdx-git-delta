'use strict'
const PackageConstructor = require('../../../../src/utils/packageConstructor')
const metadataManager = require('../../../../src/metadata/metadataManager')

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
        ]),
      })
    ),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
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

describe(`test if package constructor`, () => {
  let globalMetadata
  let packageConstructor
  beforeAll(async () => {
    globalMetadata = await metadataManager.getDefinition('directoryName', 50)
    packageConstructor = new PackageConstructor(options, globalMetadata)
  })

  test.each(tests)(
    'can build %s destructiveChanges.xml',
    (type, diff, expected) => {
      expect(packageConstructor.constructPackage(diff)).toBe(expected)
    }
  )
  test('can handle null diff', () => {
    expect(packageConstructor.constructPackage(null)).toBe(undefined)
  })
})
