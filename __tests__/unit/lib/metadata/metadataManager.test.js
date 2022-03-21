'use strict'
const metadataManager = require('../../../../src/metadata/metadataManager')

describe(`test if metadata`, () => {
  test('when grouped per directoryName, have classes', async () => {
    const metadata = await metadataManager.getDefinition('directoryName')
    expect(metadata.get('classes')).toBeDefined()
  })

  test('when grouped per directoryName, do not have do not exist', async () => {
    let metadata = await metadataManager.getDefinition('directoryName', '48')
    metadata = await metadataManager.getDefinition('directoryName', '46')
    expect(metadata).toBeDefined()
    expect(metadata.get('do not exist')).toBeFalsy()
  })
})
