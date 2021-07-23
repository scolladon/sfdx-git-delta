'use strict'
const PackageConstructor = require('../../../../src/utils/packageConstructor')

const options = { apiVersion: '46' }
const tests = [
  [
    'Object',
    { objects: ['Object'] },
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Object</members>
        <name>CustomObject</name>
    </types>
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
  [
    'empty',
    {},
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
  [
    'full',
    {
      dashboards: ['Dashboard'],
      documents: ['Document'],
      fields: ['Field'],
      lwc: ['Component'],
      objects: ['Object'],
    },
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Object</members>
        <name>CustomObject</name>
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
        <members>Field</members>
        <name>CustomField</name>
    </types>
    <types>
        <members>Component</members>
        <name>LightningComponentBundle</name>
    </types>
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
]

describe(`test if package constructor`, () => {
  // eslint-disable-next-line no-undef
  const packageConstructor = new PackageConstructor(options, globalMetadata)
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
