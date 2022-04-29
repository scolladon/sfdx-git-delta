/* eslint-disable prettier/prettier */
'use strict'
const PackageConstructor = require('../../../../src/utils/packageConstructor')
const metadataManager = require('../../../../src/metadata/metadataManager')

const options = { apiVersion: '46' }
const tests = [
  [
    'it should create package.xml with types when diffs is not empty',
    new Map(
      Object.entries({
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
        <members>Component</members>
        <name>LightningComponentBundle</name>
    </types>
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
  [
    'it should create package.xml with no types when diffs is empty',
    new Map(),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
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
  [
    `it should add folder name as an extra member when metadata type is in folder`,
    new Map(
      Object.entries({
        email: new Set([
          'folder_name_1/metadata_file_1',
          'folder_name_1/metadata_file_2',
          'folder_name_2/metadata_file_1',
        ]),
        documents: new Set([
          'folder_name_1/metadata_file_1',
          'folder_name_1/metadata_file_2',
          'folder_name_2/metadata_file_1',
        ]),
        dashboards: new Set([
          'folder_name_1/metadata_file_1',
          'folder_name_1/metadata_file_2',
          'folder_name_2/metadata_file_1',
        ]),
        reports: new Set([
          'folder_name_1/metadata_file_1',
          'folder_name_1/metadata_file_2',
          'folder_name_2/metadata_file_1',
        ]),
        waveTemplates: new Set([
          'folder_name_1/metadata_file_1',
          'folder_name_1/metadata_file_2',
          'folder_name_2/metadata_file_1',
        ]),
      })
    ),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>folder_name_1</members>
        <members>folder_name_1/metadata_file_1</members>
        <members>folder_name_1/metadata_file_2</members>
        <members>folder_name_2</members>
        <members>folder_name_2/metadata_file_1</members>
        <name>Dashboard</name>
    </types>
    <types>
        <members>folder_name_1</members>
        <members>folder_name_1/metadata_file_1</members>
        <members>folder_name_1/metadata_file_2</members>
        <members>folder_name_2</members>
        <members>folder_name_2/metadata_file_1</members>
        <name>Document</name>
    </types>
    <types>
        <members>folder_name_1</members>
        <members>folder_name_1/metadata_file_1</members>
        <members>folder_name_1/metadata_file_2</members>
        <members>folder_name_2</members>
        <members>folder_name_2/metadata_file_1</members>
        <name>EmailTemplate</name>
    </types>
    <types>
        <members>folder_name_1</members>
        <members>folder_name_1/metadata_file_1</members>
        <members>folder_name_1/metadata_file_2</members>
        <members>folder_name_2</members>
        <members>folder_name_2/metadata_file_1</members>
        <name>Report</name>
    </types>
    <types>
        <members>folder_name_1</members>
        <members>folder_name_1/metadata_file_1</members>
        <members>folder_name_1/metadata_file_2</members>
        <members>folder_name_2</members>
        <members>folder_name_2/metadata_file_1</members>
        <name>WaveTemplateBundle</name>
    </types>
    <version>${options.apiVersion}.0</version>
</Package>`,
  ],
]

describe(`package constructor`, () => {
  let packageConstructor
  beforeAll(async () => {
    let globalMetadata = await metadataManager.getDefinition(
      'directoryName',
      options.apiVersion
    )
    packageConstructor = new PackageConstructor(options, globalMetadata)
  })

  test.each(tests)('%s', (_, diff, expected) => {
    expect(packageConstructor.constructPackage(diff)).toBe(expected)
  })
  test('can handle null diff', () => {
    expect(packageConstructor.constructPackage(null)).toBe(undefined)
  })
})
