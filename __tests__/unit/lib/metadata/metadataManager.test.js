'use strict'
const metadataManager = require('../../../../lib/metadata/metadataManager')

describe(`test if metadata`, () => {
  test('when grouped per directoryName, have classes', () => {
    const metadata = metadataManager.getDefinition('directoryName')
    expect(metadata).toHaveProperty('classes')
  })

  test('when grouped per directoryName, do not have do not exist', () => {
    let metadata = metadataManager.getDefinition('directoryName', '48')
    metadata = metadataManager.getDefinition('directoryName', '46')
    expect(metadata).not.toHaveProperty('do not exist')
  })
})
