import { Writable } from 'node:stream'
import { bench, describe } from 'vitest'
import type { RootCapture } from '../../src/utils/metadataDiff/xmlEventReader.js'
import {
  type WriteOptions,
  writeXmlDocument,
} from '../../src/utils/metadataDiff/xmlWriter.js'

// A /dev/null Writable: counts bytes but throws nothing away that
// matters. Backpressure path is exercised by toggling highWaterMark.
const nullStream = (): Writable =>
  new Writable({
    highWaterMark: 64 * 1024,
    write(_chunk, _enc, cb) {
      cb()
    },
  })

const buildLabelChildren = (count: number): Array<[string, unknown]> => {
  const children: Array<[string, unknown]> = []
  for (let i = 0; i < count; i++) {
    children.push([
      'labels',
      {
        fullName: `Label_${i}`,
        language: 'en_US',
        protected: 'false',
        shortDescription: `Short_${i}`,
        value: `Value ${i} with words`,
      },
    ])
  }
  return children
}

const buildProfileChildren = (count: number): Array<[string, unknown]> => {
  const children: Array<[string, unknown]> = []
  for (let i = 0; i < count; i++) {
    children.push([
      'fieldPermissions',
      {
        editable: 'true',
        field: `Account.Field_${i}__c`,
        readable: 'true',
      },
    ])
  }
  for (let i = 0; i < Math.floor(count / 2); i++) {
    children.push([
      'objectPermissions',
      {
        allowCreate: 'true',
        allowDelete: 'false',
        allowEdit: 'true',
        allowRead: 'true',
        modifyAllRecords: 'false',
        object: `Object_${i}__c`,
        viewAllRecords: 'false',
      },
    ])
  }
  children.push(['userLicense', 'Salesforce'])
  return children
}

const captureFor = (rootKey: string): RootCapture => ({
  xmlHeader: { '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' } },
  rootKey,
  rootAttributes: { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata' },
})

const FIXTURES = {
  smallLabels: {
    capture: captureFor('CustomLabels'),
    children: buildLabelChildren(20),
  },
  mediumProfile: {
    capture: captureFor('Profile'),
    children: buildProfileChildren(200),
  },
  largeProfile: {
    capture: captureFor('Profile'),
    children: buildProfileChildren(2000),
  },
} as const

const writeOpts: WriteOptions = {}

for (const [size, fixture] of Object.entries(FIXTURES) as Array<
  [keyof typeof FIXTURES, (typeof FIXTURES)[keyof typeof FIXTURES]]
>) {
  describe(`xml-write-${size}`, () => {
    bench(`writeXmlDocument-${size}`, async () => {
      const out = nullStream()
      await writeXmlDocument(out, fixture.capture, fixture.children, writeOpts)
    })
  })
}
